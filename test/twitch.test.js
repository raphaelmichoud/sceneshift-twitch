import test from "node:test";
import assert from "node:assert/strict";
import { Twitch, safeReconnect } from "../src/twitch.js";
class Socket {
  static all = [];
  constructor(url) {
    this.url = url;
    this.events = {};
    Socket.all.push(this);
  }
  addEventListener(t, f) {
    this.events[t] = f;
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.events.close?.();
  }
  async message(type, payload) {
    await this.events.message({
      data: JSON.stringify({
        metadata: {
          message_type: type,
          message_id: "test",
          message_timestamp: new Date().toISOString(),
        },
        payload,
      }),
    });
  }
}
function fixture() {
  Socket.all = [];
  const calls = [],
    events = [],
    saved = [];
  const fetcher = async (url, o) => {
    calls.push({ url, o });
    return {
      ok: true,
      json: async () =>
        url.endsWith("/validate")
          ? {
              client_id: "client",
              user_id: "123",
              login: "mara",
              scopes: ["user:read:chat"],
            }
          : { data: [] },
    };
  };
  const t = new Twitch({
    clientId: "client",
    clientSecret: "secret",
    redirectUri: "http://localhost/auth/callback",
    Socket,
    fetcher,
    onEvent: (...e) => events.push(e),
    save: (c) => saved.push(c),
  });
  return { t, calls, events, saved };
}
test("validates broadcaster and creates four EventSub subscriptions on welcome", async () => {
  const { t, calls } = fixture();
  await t.start({ access_token: "test" });
  const ws = Socket.all[0];
  await ws.message("session_welcome", {
    session: { id: "session", keepalive_timeout_seconds: 10 },
  });
  assert.equal(t.status.state, "connected");
  const subscriptions = calls.filter((c) => c.url.includes("/helix/"));
  assert.equal(subscriptions.length, 4);
  for (const c of subscriptions) {
    const b = JSON.parse(c.o.body);
    assert.equal(b.condition.broadcaster_user_id, "123");
    assert.equal(b.condition.user_id, "123");
    assert.equal(b.transport.session_id, "session");
  }
  t.stop();
});
test("accepts channel messages only for authorized broadcaster", async () => {
  const { t, events } = fixture();
  await t.start({ access_token: "test" });
  const ws = Socket.all[0];
  await ws.message("notification", {
    subscription: { type: "channel.chat.message" },
    event: { broadcaster_user_id: "other" },
  });
  assert.equal(events.length, 0);
  await ws.message("notification", {
    subscription: { type: "channel.chat.message" },
    event: { broadcaster_user_id: "123" },
  });
  assert.equal(events.length, 1);
  t.stop();
});
test("Twitch migration preserves old connection until new welcome and does not resubscribe", async () => {
  const { t, calls } = fixture();
  await t.start({ access_token: "test" });
  const old = Socket.all[0];
  await old.message("session_welcome", { session: { id: "one" } });
  await old.message("session_reconnect", {
    session: {
      reconnect_url: "wss://eventsub.wss.twitch.tv/ws?reconnect=test",
    },
  });
  assert.equal(old.closed, undefined);
  await Socket.all[1].message("session_welcome", { session: { id: "two" } });
  assert.equal(old.closed, true);
  assert.equal(t.active, Socket.all[1]);
  assert.equal(calls.filter((c) => c.url.includes("/helix/")).length, 4);
  t.stop();
});
test("revocation stops listener and rejects untrusted reconnect addresses", async () => {
  assert.equal(safeReconnect("wss://attacker.test/ws"), false);
  assert.equal(
    safeReconnect("wss://eventsub.wss.twitch.tv@evil.test/ws"),
    false,
  );
  assert.equal(safeReconnect("https://eventsub.wss.twitch.tv/ws"), false);
  const { t } = fixture();
  await t.start({ access_token: "test" });
  await Socket.all[0].message("revocation", {});
  assert.equal(t.status.state, "error");
  assert.equal(t.sockets.size, 0);
});
test("wrong configured broadcaster cannot connect", async () => {
  const { t } = fixture();
  t.broadcasterId = "other";
  await assert.rejects(
    t.start({ access_token: "test" }),
    /configured broadcaster/,
  );
  assert.equal(Socket.all.length, 0);
  t.stop();
});
