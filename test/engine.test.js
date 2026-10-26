import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  ingest,
  command,
  tick,
  publicState,
  checkEffect,
} from "../src/engine.js";
const chat = (s, u, t, id = u + t) =>
  ingest(s, { userId: u, author: u, text: t, messageId: id }, 1000);
function prepared() {
  const s = initialState();
  chat(s, "a", "!twist A tiny storm hatches.");
  chat(s, "b", "!twist The glass begins to sing.");
  s.proposals.forEach((p) => command(s, "approve", { id: p.id }, 1000));
  return s;
}
test("viewer proposals stay private until streamer approval", () => {
  const s = initialState();
  chat(s, "a", "!twist A storm");
  assert.equal(publicState(s).proposals.length, 0);
  command(s, "approve", { id: s.proposals[0].id });
  assert.equal(publicState(s).proposals.length, 1);
  assert.ok(!("votes" in publicState(s)));
  assert.ok(!("banned" in publicState(s)));
});
test("one proposal per viewer, bounds, deduplication and block terms", () => {
  const s = initialState();
  command(s, "terms", { terms: ["bad phrase"] });
  assert.equal(chat(s, "a", "!twist bad PHRASE"), false);
  assert.equal(chat(s, "a", "!twist " + "x".repeat(181)), false);
  assert.equal(chat(s, "a", "!twist A storm", "same"), true);
  assert.equal(chat(s, "b", "!twist Another", "same"), false);
  assert.equal(chat(s, "a", "!twist Another"), false);
});
test("last vote replaces prior choice; duplicate message does not replay", () => {
  const s = prepared();
  command(s, "open", { seconds: 10 }, 1000);
  chat(s, "v", "!vote 1", "one");
  chat(s, "v", "!vote 2", "two");
  chat(s, "v", "!vote 1", "one");
  assert.deepEqual(Object.values(s.votes), [s.proposals[1].id]);
  assert.equal(chat(s, "w", "!vote 4"), false);
});
test("ties use stage order, no votes produce no winner", () => {
  let s = prepared();
  command(s, "open", {}, 1000);
  chat(s, "v", "!vote 2");
  chat(s, "w", "!vote 1");
  command(s, "close", {}, 1000);
  assert.equal(s.winnerId, s.proposals[0].id);
  s = prepared();
  command(s, "open", {}, 1000);
  command(s, "close", {}, 1000);
  assert.equal(s.winnerId, null);
  assert.throws(() => command(s, "commit"));
});
test("deadline is authoritative even if timer has not fired", () => {
  const s = prepared();
  command(s, "open", { seconds: 10 }, 1000);
  assert.equal(
    ingest(
      s,
      { userId: "late", author: "late", messageId: "late", text: "!vote 1" },
      11000,
    ),
    false,
  );
  assert.equal(s.phase, "revealed");
  assert.equal(Object.keys(s.votes).length, 0);
  assert.equal(tick(s, 20000), false);
});
test("only streamer commits canon and facts; locked effect is rejected", () => {
  const s = prepared();
  assert.throws(
    () => checkEffect(s, { key: "keeper", value: "Someone else" }),
    /Continuity lock/,
  );
  assert.equal(checkEffect(s, { key: "keeper", value: "Mara" }).value, "Mara");
  s.proposals[1].effect = { key: "lens", value: "singing" };
  command(s, "open", {}, 1000);
  chat(s, "v", "!vote 2");
  command(s, "close", {}, 1000);
  assert.equal(s.canon.length, 0);
  command(s, "commit", {}, 1000);
  assert.equal(s.canon.length, 1);
  assert.equal(s.facts.find((f) => f.key === "lens").value, "singing");
  assert.throws(() => command(s, "commit"));
  command(s, "next", { prompt: "What sings back?" }, 1000);
  assert.equal(s.round, 2);
  assert.equal(s.proposals.length, 0);
  assert.equal(s.canon.length, 1);
});
test("permissions and phase rules prevent viewer control or editing live options", () => {
  const s = prepared();
  chat(s, "evil", "!commit");
  assert.equal(s.canon.length, 0);
  assert.throws(() => command(s, "next", { prompt: "skip" }));
  command(s, "open", {}, 1000);
  assert.throws(() => command(s, "reject", { id: s.proposals[0].id }, 1000));
  assert.throws(() => command(s, "fact", { key: "test", value: "x" }, 1000));
  assert.equal(chat(s, "c", "!twist late"), false);
});
test("ban removes participation and future proposals", () => {
  const s = prepared();
  command(s, "ban", { id: s.proposals[0].id });
  assert.equal(s.proposals[0].status, "rejected");
  assert.equal(chat(s, "a", "!twist retry"), false);
});
test("capacity limits and malformed inputs are deterministic", () => {
  const s = initialState();
  for (let i = 0; i < 51; i++) chat(s, `u${i}`, `!twist idea ${i}`);
  assert.equal(s.proposals.length, 50);
  for (let i = 0; i < 4; i++) command(s, "approve", { id: s.proposals[i].id });
  assert.throws(() => command(s, "approve", { id: s.proposals[4].id }), /four/);
  assert.throws(() => command(s, "open", { seconds: 1 }));
  assert.throws(() => command(s, "fact", { key: "__proto__", value: "x" }));
});
