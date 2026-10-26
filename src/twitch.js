const ENDPOINT = "wss://eventsub.wss.twitch.tv/ws";
const TYPES = [
  "channel.chat.message",
  "channel.chat.message_delete",
  "channel.chat.clear_user_messages",
  "channel.chat.clear",
];
export function safeReconnect(url) {
  try {
    const u = new URL(url);
    return (
      u.protocol === "wss:" &&
      u.hostname === "eventsub.wss.twitch.tv" &&
      !u.username &&
      !u.password &&
      (!u.port || u.port === "443")
    );
  } catch {
    return false;
  }
}
export class Twitch {
  constructor({
    clientId,
    clientSecret,
    redirectUri,
    broadcasterId = "",
    fetcher = fetch,
    Socket = WebSocket,
    onEvent = () => {},
    onStatus = () => {},
    save = () => {},
  }) {
    Object.assign(this, {
      clientId,
      clientSecret,
      redirectUri,
      broadcasterId,
      fetcher,
      Socket,
      onEvent,
      onStatus,
      save,
    });
    this.status = { state: "disconnected", channel: null };
    this.generation = 0;
    this.sockets = new Set();
    this.retry = 0;
  }
  setStatus(state, detail = "") {
    this.status = { state, detail, channel: this.credentials?.login ?? null };
    this.onStatus(this.status);
  }
  async request(url, options = {}) {
    const r = await this.fetcher(url, {
      ...options,
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok)
      throw new Error(
        `Twitch request failed (${r.status}). Reconnect Twitch if authorization expired.`,
      );
    return r.json();
  }
  async token(params) {
    return this.request("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        ...params,
      }),
    });
  }
  async validate(c) {
    let v;
    try {
      v = await this.request("https://id.twitch.tv/oauth2/validate", {
        headers: { Authorization: `OAuth ${c.access_token}` },
      });
    } catch (e) {
      if (!c.refresh_token) throw e;
      const fresh = await this.token({
        grant_type: "refresh_token",
        refresh_token: c.refresh_token,
      });
      Object.assign(c, fresh);
      v = await this.request("https://id.twitch.tv/oauth2/validate", {
        headers: { Authorization: `OAuth ${c.access_token}` },
      });
    }
    if (
      v.client_id !== this.clientId ||
      !v.scopes?.includes("user:read:chat") ||
      !v.user_id ||
      (this.broadcasterId && v.user_id !== this.broadcasterId)
    )
      throw new Error(
        "Authorize the configured broadcaster account with chat read permission.",
      );
    Object.assign(c, { userId: v.user_id, login: v.login });
    return c;
  }
  async authorize(code) {
    const c = await this.token({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.redirectUri,
    });
    return this.start(c);
  }
  async start(credentials) {
    this.stop(false);
    const generation = this.generation;
    const c = await this.validate({ ...credentials });
    if (generation !== this.generation) return;
    this.credentials = c;
    this.save(c);
    this.connect(ENDPOINT, false, generation);
    this.validation = setInterval(async () => {
      try {
        await this.validate(this.credentials);
        this.save(this.credentials);
      } catch {
        this.stop(false);
        this.setStatus(
          "error",
          "Authorization unavailable. Connect Twitch again.",
        );
      }
    }, 3600000);
    this.validation.unref?.();
  }
  stop(erase = true) {
    this.generation++;
    clearTimeout(this.retryTimer);
    clearInterval(this.validation);
    for (const s of this.sockets) s.close();
    this.sockets.clear();
    this.active = null;
    if (erase) {
      this.credentials = null;
      this.save(null);
    }
    this.setStatus("disconnected");
  }
  connect(url, migrating = false, generation = this.generation) {
    if (generation !== this.generation || !this.credentials) return;
    if (!safeReconnect(url)) {
      this.setStatus("error", "Twitch provided an invalid reconnect address.");
      return;
    }
    this.setStatus("connecting");
    const ws = new this.Socket(url);
    this.sockets.add(ws);
    let welcomed = false;
    let timer;
    const watchdog = (seconds = 15) => {
      clearTimeout(timer);
      timer = setTimeout(() => ws.close(), (seconds + 3) * 1000);
      timer.unref?.();
    };
    watchdog();
    ws.addEventListener("message", async ({ data }) => {
      if (generation !== this.generation) return;
      try {
        const m = JSON.parse(String(data));
        const type = m.metadata?.message_type;
        watchdog(ws.keepalive ?? 15);
        if (type === "session_welcome") {
          welcomed = true;
          ws.keepalive = m.payload.session.keepalive_timeout_seconds ?? 15;
          watchdog(ws.keepalive);
          if (!migrating) {
            for (const event of TYPES)
              await this.request(
                "https://api.twitch.tv/helix/eventsub/subscriptions",
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${this.credentials.access_token}`,
                    "Client-Id": this.clientId,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    type: event,
                    version: "1",
                    condition: {
                      broadcaster_user_id: this.credentials.userId,
                      user_id: this.credentials.userId,
                    },
                    transport: {
                      method: "websocket",
                      session_id: m.payload.session.id,
                    },
                  }),
                },
              );
          }
          if (generation !== this.generation) {
            ws.close();
            return;
          }
          const old = this.active;
          this.active = ws;
          this.retry = 0;
          this.setStatus("connected");
          if (old && old !== ws) old.close();
        } else if (type === "session_reconnect") {
          this.connect(m.payload.session.reconnect_url, true, generation);
        } else if (type === "revocation") {
          this.stop(false);
          this.setStatus(
            "error",
            "Twitch revoked chat access. Connect Twitch again.",
          );
        } else if (
          type === "notification" &&
          TYPES.includes(m.payload?.subscription?.type)
        ) {
          const event = m.payload.event;
          if (event.broadcaster_user_id === this.credentials.userId)
            this.onEvent(m.payload.subscription.type, event, m.metadata);
        }
      } catch {
        this.setStatus(
          "error",
          "Twitch connection failed. Retrying; reauthorize if it persists.",
        );
        ws.close();
      }
    });
    ws.addEventListener("error", () => {
      this.setStatus("error", "Twitch network unavailable. Retrying.");
      ws.close();
    });
    ws.addEventListener("close", () => {
      clearTimeout(timer);
      this.sockets.delete(ws);
      if (generation !== this.generation) return;
      if (this.active && this.active !== ws) return;
      this.active = null;
      this.setStatus(
        "reconnecting",
        "Messages during disconnection are not replayed by Twitch.",
      );
      clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(
        () => this.connect(ENDPOINT, false, generation),
        Math.min(30000, 1000 * 2 ** Math.min(this.retry++, 5)),
      );
      this.retryTimer.unref?.();
    });
  }
}
