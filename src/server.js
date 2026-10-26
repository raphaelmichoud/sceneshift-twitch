import http from "node:http";
import {
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  existsSync,
  chmodSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  initialState,
  publicState,
  privateState,
  command,
  ingest,
  tick,
  log,
  RuleError,
} from "./engine.js";
import { Twitch } from "./twitch.js";
import { applyTwitchEvent } from "./events.js";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 3000),
  host = process.env.HOST || "127.0.0.1";
const base = new URL(process.env.BASE_URL || `http://localhost:${port}`);
const data = resolve(process.env.DATA_DIR || join(root, "data"));
mkdirSync(data, { recursive: true, mode: 0o700 });
const atomic = (name, value) => {
  const p = join(data, name);
  writeFileSync(p + ".tmp", JSON.stringify(value), { mode: 0o600 });
  renameSync(p + ".tmp", p);
  chmodSync(p, 0o600);
};
let key = process.env.ADMIN_KEY;
if (!key) {
  if (!["127.0.0.1", "localhost", "::1"].includes(host))
    throw new Error(
      "Set ADMIN_KEY (24+ characters) before exposing the server.",
    );
  const p = join(data, "admin.key");
  if (!existsSync(p))
    writeFileSync(p, randomBytes(32).toString("hex"), { mode: 0o600 });
  key = readFileSync(p, "utf8").trim();
}
if (key.length < 24)
  throw new Error("ADMIN_KEY must have at least 24 characters.");
let state = existsSync(join(data, "state.json"))
  ? JSON.parse(readFileSync(join(data, "state.json"), "utf8"))
  : initialState();
if (state.version !== 1)
  throw new Error("Unsupported state version. Restore a version 1 backup.");
const clients = new Set(),
  sessions = new Map(),
  oauth = new Map(),
  attempts = new Map();
const equal = (a, b) => {
  const x = Buffer.from(a || ""),
    y = Buffer.from(b || "");
  return x.length === y.length && timingSafeEqual(x, y);
};
const authenticated = (req) => {
  const cookie = req.headers.cookie
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("ss_session="))
    ?.slice(11);
  const expires = sessions.get(cookie);
  return !!expires && expires > Date.now();
};
const json = (res, status, value) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
};
const persist = () => atomic("state.json", state);
const view = (admin) => ({
  ...(admin ? privateState(state) : publicState(state)),
  twitch: twitch.status,
  serverTime: Date.now(),
});
const broadcast = () => {
  for (const c of clients)
    c.res.write(
      `data: ${JSON.stringify(view(!c.publicOnly && authenticated(c.req)))}\n\n`,
    );
};
const changed = () => {
  persist();
  broadcast();
};
const twitch = new Twitch({
  clientId: process.env.TWITCH_CLIENT_ID,
  clientSecret: process.env.TWITCH_CLIENT_SECRET,
  redirectUri: new URL("/auth/callback", base).href,
  broadcasterId: process.env.TWITCH_BROADCASTER_ID,
  onStatus: () => broadcast(),
  save: (c) => atomic("twitch.json", c),
  onEvent: (type, e, m) => {
    if (applyTwitchEvent(state, type, e, m)) changed();
  },
});
async function body(req) {
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > 16384)
      throw new RuleError("Request too large.");
  }
  try {
    return JSON.parse(text || "{}");
  } catch {
    throw new RuleError("Invalid JSON.");
  }
}
const staticFiles = {
  "/": "index.html",
  "/overlay": "index.html",
  "/app.js": "app.js",
  "/style.css": "style.css",
  "/favicon.svg": "favicon.svg",
};
const server = http.createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'self'",
  );
  try {
    const url = new URL(req.url, base),
      admin = authenticated(req);
    if (req.method === "POST") {
      if (req.headers.origin !== base.origin)
        return json(res, 403, { error: "Origin not allowed." });
      if (url.pathname === "/api/login") {
        const ip = req.socket.remoteAddress,
          a = attempts.get(ip) || { count: 0, until: 0 };
        if (a.until > Date.now() && a.count >= 10)
          return json(res, 429, {
            error: "Too many attempts. Try again in one minute.",
          });
        const b = await body(req);
        if (!equal(b.key, key)) {
          if (a.until < Date.now()) {
            a.count = 0;
            a.until = Date.now() + 60000;
          }
          a.count++;
          attempts.set(ip, a);
          return json(res, 401, { error: "Incorrect studio key." });
        }
        attempts.delete(ip);
        const session = randomBytes(32).toString("hex");
        sessions.set(session, Date.now() + 12 * 3600000);
        res.setHeader(
          "Set-Cookie",
          `ss_session=${session}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${base.protocol === "https:" ? "; Secure" : ""}`,
        );
        return json(res, 200, { ok: true });
      }
      if (!admin) return json(res, 401, { error: "Unlock the studio first." });
      const b = await body(req);
      if (url.pathname === "/api/logout") {
        const id = req.headers.cookie
          ?.split(";")
          .map((x) => x.trim())
          .find((x) => x.startsWith("ss_session="))
          ?.slice(11);
        sessions.delete(id);
        broadcast();
        res.setHeader(
          "Set-Cookie",
          "ss_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
        );
        return json(res, 200, { ok: true });
      }
      if (url.pathname === "/api/action") {
        // Apply to a copy: rejected actions cannot partially mutate persisted state.
        const draft = structuredClone(state);
        command(draft, b.action, b.payload);
        state = draft;
        changed();
        return json(res, 200, view(true));
      }
      if (url.pathname === "/api/simulate") {
        if (twitch.status.state !== "disconnected")
          throw new RuleError("Disconnect Twitch before using rehearsal chat.");
        const user = String(b.user ?? "viewer").trim();
        if (!/^[a-zA-Z0-9_]{1,25}$/.test(user))
          throw new RuleError(
            "Use a viewer name with letters, digits, or underscores.",
          );
        const accepted = ingest(state, {
          userId: `demo:${user.toLowerCase()}`,
          author: user,
          text: b.text,
          messageId: randomBytes(16).toString("hex"),
          source: "rehearsal",
        });
        changed();
        return json(res, 200, { accepted, state: view(true) });
      }
      if (url.pathname === "/api/reset") {
        if (twitch.status.state !== "disconnected")
          throw new RuleError(
            "Disconnect Twitch before resetting the rehearsal.",
          );
        state = initialState();
        changed();
        return json(res, 200, view(true));
      }
      if (url.pathname === "/api/twitch/disconnect") {
        twitch.stop();
        return json(res, 200, { ok: true });
      }
      return json(res, 404, { error: "Not found." });
    }
    if (req.method !== "GET")
      return json(res, 405, { error: "Method not allowed." });
    if (url.pathname === "/health") return json(res, 200, { ok: true });
    if (url.pathname === "/api/state")
      return json(
        res,
        200,
        view(admin && url.searchParams.get("public") !== "1"),
      );
    if (url.pathname === "/api/export") {
      if (!admin) return json(res, 401, { error: "Unlock the studio first." });
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="sceneshift-canon.json"',
      );
      return json(res, 200, {
        title: state.title,
        facts: state.facts,
        canon: state.canon,
        history: state.history,
      });
    }
    if (url.pathname === "/api/events") {
      if (clients.size >= 100)
        return json(res, 503, { error: "Too many overlay connections." });
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.write(
        `data: ${JSON.stringify(view(admin && url.searchParams.get("public") !== "1"))}\n\n`,
      );
      const c = {
        res,
        req,
        publicOnly: url.searchParams.get("public") === "1",
      };
      clients.add(c);
      req.on("close", () => clients.delete(c));
      return;
    }
    if (url.pathname === "/auth/twitch") {
      if (!admin) return json(res, 401, { error: "Unlock the studio first." });
      if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET)
        throw new RuleError(
          "Add Twitch app credentials to .env and restart. See README.",
        );
      if (state.phase !== "collecting" || state.proposals.length)
        throw new RuleError(
          "Start an empty scene before connecting Twitch. Rehearsal choices cannot enter a live round.",
        );
      const nonce = randomBytes(24).toString("hex");
      oauth.set(nonce, {
        expires: Date.now() + 600000,
        cookie: req.headers.cookie,
      });
      const target = new URL("https://id.twitch.tv/oauth2/authorize");
      target.search = new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID,
        redirect_uri: new URL("/auth/callback", base).href,
        response_type: "code",
        scope: "user:read:chat",
        state: nonce,
        force_verify: "true",
      });
      res.writeHead(302, { Location: target.href });
      res.end();
      return;
    }
    if (url.pathname === "/auth/callback") {
      const pending = oauth.get(url.searchParams.get("state"));
      oauth.delete(url.searchParams.get("state"));
      if (
        !admin ||
        !pending ||
        pending.expires < Date.now() ||
        pending.cookie !== req.headers.cookie
      )
        throw new RuleError(
          "Twitch sign-in expired. Reconnect from the studio.",
        );
      if (!url.searchParams.get("code"))
        throw new RuleError("Twitch authorization was declined.");
      await twitch.authorize(url.searchParams.get("code"));
      res.writeHead(302, { Location: "/" });
      res.end();
      return;
    }
    const file = staticFiles[url.pathname];
    if (file) {
      res.setHeader(
        "Content-Type",
        file.endsWith(".css")
          ? "text/css"
          : file.endsWith(".js")
            ? "text/javascript"
            : file.endsWith(".svg")
              ? "image/svg+xml"
              : "text/html",
      );
      res.end(readFileSync(join(root, "public", file)));
      return;
    }
    json(res, 404, { error: "Not found." });
  } catch (e) {
    json(res, e instanceof RuleError ? 400 : 500, {
      error:
        e instanceof RuleError
          ? e.message
          : "The request failed. Check configuration and try again.",
    });
  }
});
const timer = setInterval(() => {
  if (tick(state)) changed();
  for (const c of clients) c.res.write(": heartbeat\n\n");
  for (const [k, v] of sessions) if (v < Date.now()) sessions.delete(k);
  for (const [k, v] of oauth) if (v.expires < Date.now()) oauth.delete(k);
}, 1000);
timer.unref();
server.listen(port, host, () =>
  console.log(
    `SceneShift studio: ${base.href}\nOverlay: ${new URL("/overlay", base).href}\nStudio key: ${process.env.ADMIN_KEY ? "configured via ADMIN_KEY" : join(data, "admin.key")}\nNo runtime AI. Rehearsal is available without Twitch credentials.`,
  ),
);
if (existsSync(join(data, "twitch.json")) && process.env.TWITCH_CLIENT_ID) {
  const c = JSON.parse(readFileSync(join(data, "twitch.json"), "utf8"));
  if (c)
    twitch
      .start(c)
      .catch(() =>
        twitch.setStatus(
          "error",
          "Stored authorization could not be validated. Connect Twitch again.",
        ),
      );
}
for (const sig of ["SIGINT", "SIGTERM"])
  process.on(sig, () => {
    twitch.stop(false);
    persist();
    for (const c of clients) c.res.end();
    server.close(() => process.exit(0));
  });
