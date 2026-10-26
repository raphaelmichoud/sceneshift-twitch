import test from "node:test";
import assert from "node:assert/strict";
import { applyTwitchEvent } from "../src/events.js";
import { initialState, command, publicState } from "../src/engine.js";
const now = 1000000;
let serial = 0;
const meta = () => ({
  message_id: "event" + serial++,
  message_timestamp: new Date(now).toISOString(),
});
function message(s, id, user, text, extra = {}) {
  return applyTwitchEvent(
    s,
    "channel.chat.message",
    {
      message_id: id,
      chatter_user_id: user,
      chatter_user_name: user,
      broadcaster_user_id: "channel",
      message: { text },
      ...extra,
    },
    meta(),
    now,
  );
}
function ready() {
  const s = initialState();
  message(s, "chat-a", "a", "!twist Storm");
  message(s, "chat-b", "b", "!twist Song");
  s.proposals.forEach((p) => command(s, "approve", { id: p.id }, now));
  return s;
}
test("EventSub chat enters the common parser and tracks both IDs", () => {
  const s = initialState();
  message(s, "chat-a", "a", "!twist Storm");
  assert.equal(s.proposals[0].messageId, "chat-a");
  message(s, "chat-a", "a", "!twist Storm");
  assert.equal(s.proposals.length, 1);
  assert.ok(s.seen.includes("chat-a"));
});
test("replayed, stale, malformed, and other-origin Shared Chat events are ignored", () => {
  const s = initialState(),
    m = meta(),
    e = {
      message_id: "a",
      chatter_user_id: "a",
      chatter_user_name: "a",
      message: { text: "!twist Storm" },
    };
  applyTwitchEvent(s, "channel.chat.message", e, m, now);
  assert.equal(applyTwitchEvent(s, "channel.chat.message", e, m, now), false);
  assert.equal(
    applyTwitchEvent(s, "channel.chat.clear", {}, meta(), now + 600001),
    false,
  );
  assert.equal(
    applyTwitchEvent(
      s,
      "channel.chat.clear",
      {},
      { ...meta(), message_timestamp: "invalid" },
      now,
    ),
    false,
  );
  message(s, "b", "b", "!twist Shared", {
    source_broadcaster_user_id: "other",
  });
  assert.equal(s.proposals.length, 1);
});
test("Twitch deletion finds chat ID, removes option, and cancels active result", () => {
  const s = ready();
  command(s, "open", {}, now);
  message(s, "vote", "v", "!vote 1");
  applyTwitchEvent(
    s,
    "channel.chat.message_delete",
    { message_id: "chat-a" },
    meta(),
    now,
  );
  assert.equal(s.phase, "revealed");
  assert.equal(s.winnerId, null);
  assert.equal(s.deadline, null);
  assert.equal(s.totalVotes, undefined);
  assert.equal(publicState(s).totalVotes, 0);
  assert.equal(publicState(s).proposals.length, 1);
  assert.equal(s.proposals[0].text, "[Removed by Twitch moderation]");
  assert.throws(() => command(s, "commit", {}, now));
});
test("Twitch clear user events remove that viewer’s current ballot", () => {
  const s = ready();
  command(s, "open", {}, now);
  message(s, "v1", "viewer", "!vote 1");
  applyTwitchEvent(
    s,
    "channel.chat.clear_user_messages",
    { target_user_id: "viewer" },
    meta(),
    now,
  );
  assert.equal(publicState(s).totalVotes, 0);
  assert.equal(s.phase, "voting");
});
test("committed canon remains streamer-owned after chat deletion", () => {
  const s = ready();
  command(s, "open", {}, now);
  message(s, "v", "viewer", "!vote 1");
  command(s, "close", {}, now);
  command(s, "commit", {}, now);
  applyTwitchEvent(s, "channel.chat.clear", {}, meta(), now);
  assert.equal(s.phase, "canon");
  assert.equal(s.canon.length, 1);
});
