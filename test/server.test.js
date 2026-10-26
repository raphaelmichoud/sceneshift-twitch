import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
test("HTTP end-to-end: auth, proposal moderation, voting, overlay, canon, persistence", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sceneshift-test-"));
  const port = String(32000 + Math.floor(Math.random() * 10000));
  const base = `http://127.0.0.1:${port}`;
  const key = "test-studio-key-longer-than-24-chars";
  let child,
    cookie = "";
  const start = async () => {
    child = spawn(process.execPath, ["src/server.js"], {
      cwd: new URL("..", import.meta.url),
      env: {
        ...process.env,
        PORT: port,
        HOST: "127.0.0.1",
        BASE_URL: base,
        ADMIN_KEY: key,
        DATA_DIR: dir,
        TWITCH_CLIENT_ID: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    await Promise.race([
      once(child.stdout, "data"),
      once(child, "exit").then(() => {
        throw Error("Server failed");
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(Error("Startup timed out")), 5000).unref(),
      ),
    ]);
  };
  const call = async (path, b, auth = true, origin = base) => {
    const r = await fetch(base + path, {
      method: b === undefined ? "GET" : "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: auth ? cookie : "",
      },
      body: b === undefined ? undefined : JSON.stringify(b),
    });
    const d = await r.json();
    return { r, d };
  };
  try {
    await start();
    assert.equal(
      (await call("/api/action", { action: "open" }, false)).r.status,
      401,
    );
    assert.equal(
      (await call("/api/login", { key }, false, "https://evil.test")).r.status,
      403,
    );
    let result = await call("/api/login", { key });
    cookie = result.r.headers.get("set-cookie").split(";")[0];
    assert.match(cookie, /ss_session=/);
    for (const [user, text] of [
      ["fox", "The lens hatches a storm."],
      ["owl", "The sea starts singing."],
    ])
      assert.equal(
        (await call("/api/simulate", { user, text: "!twist " + text })).d
          .accepted,
        true,
      );
    assert.equal(
      (await call("/api/state", undefined, false)).d.proposals.length,
      0,
    );
    assert.equal((await call("/api/state?public=1")).d.proposals.length, 0);
    const proposals = (await call("/api/state")).d.proposals;
    for (const p of proposals)
      assert.equal(
        (
          await call("/api/action", {
            action: "approve",
            payload: { id: p.id },
          })
        ).r.status,
        200,
      );
    assert.equal(
      (await call("/api/action", { action: "open", payload: { seconds: 10 } }))
        .r.status,
      200,
    );
    for (const [user, text] of [
      ["one", "!vote 1"],
      ["one", "!vote 2"],
      ["two", "!vote 2"],
    ])
      await call("/api/simulate", { user, text });
    assert.equal((await call("/api/state", undefined, false)).d.totalVotes, 2);
    await call("/api/action", { action: "close" });
    result = await call("/api/action", { action: "commit" });
    assert.equal(result.d.canon[0].text, "The sea starts singing.");
    assert.equal(
      (await call("/api/action", { action: "commit" })).r.status,
      400,
    );
    const expiredCookie = cookie;
    await call("/api/logout", {});
    assert.equal(
      (await call("/api/action", { action: "close" })).r.status,
      401,
    );
    assert.equal((await call("/api/state")).d.activity, undefined);
    result = await call("/api/login", { key });
    cookie = result.r.headers.get("set-cookie").split(";")[0];
    assert.notEqual(cookie, expiredCookie);
    const html = await fetch(base + "/overlay");
    assert.equal(html.status, 200);
    assert.match(
      html.headers.get("content-security-policy"),
      /default-src 'self'/,
    );
    assert.equal((await call("/../.env")).r.status, 404);
    assert.equal((await call("/api/export")).d.canon.length, 1);
    child.kill("SIGTERM");
    await once(child, "exit");
    cookie = "";
    await start();
    assert.equal(
      (await call("/api/state", undefined, false)).d.canon.length,
      1,
    );
  } finally {
    if (child?.exitCode === null) {
      child.kill("SIGTERM");
      await once(child, "exit");
    }
    await rm(dir, { recursive: true, force: true });
  }
});
