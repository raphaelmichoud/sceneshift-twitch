import { randomUUID } from "node:crypto";
export class RuleError extends Error {}
const fail = (message) => {
  throw new RuleError(message);
};
export function clean(value, max = 180) {
  if (typeof value !== "string") fail("Text is required.");
  const text = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || text.length > max) fail(`Use between 1 and ${max} characters.`);
  return text;
}
export function initialState() {
  return {
    version: 1,
    round: 1,
    phase: "collecting",
    title: "The Last Lighthouse",
    prompt:
      "The light has gone out. Something is knocking from inside the lens. What happens next?",
    proposals: [],
    votes: {},
    deadline: null,
    winnerId: null,
    canon: [],
    facts: [
      { key: "keeper", value: "Mara", locked: true },
      { key: "location", value: "Greywake Island", locked: true },
    ],
    blockedTerms: [],
    banned: [],
    seen: [],
    activity: [],
    history: [],
  };
}
export function publicState(s) {
  const { votes, seen, banned, blockedTerms, activity, ...rest } = s;
  const approved = s.proposals.filter((p) => p.status === "approved");
  return {
    ...rest,
    proposals: approved.map((p) => ({
      id: p.id,
      text: p.text,
      author: p.author,
      source: p.source,
      effect: p.effect,
      votes: Object.values(votes).filter((v) => v === p.id).length,
    })),
    totalVotes: Object.keys(votes).length,
  };
}
export function privateState(s) {
  return {
    ...publicState(s),
    proposals: s.proposals.map((p) => ({
      ...p,
      votes: Object.values(s.votes).filter((v) => v === p.id).length,
    })),
    blockedTerms: s.blockedTerms,
    banned: s.banned,
    activity: s.activity,
  };
}
export function log(s, text, now) {
  s.activity.unshift({ text, at: now });
  s.activity = s.activity.slice(0, 35);
}
export function closeVote(s, now = Date.now()) {
  if (s.phase !== "voting") fail("There is no open vote.");
  const options = s.proposals.filter((p) => p.status === "approved");
  const counts = Object.values(s.votes);
  options.sort(
    (a, b) =>
      counts.filter((v) => v === b.id).length -
        counts.filter((v) => v === a.id).length || a.order - b.order,
  );
  s.winnerId = counts.length ? options[0].id : null;
  s.phase = "revealed";
  s.deadline = null;
  log(
    s,
    s.winnerId
      ? "Vote closed. Winner awaits streamer canon approval."
      : "No votes. No winner selected.",
    now,
  );
}
export function tick(s, now = Date.now()) {
  if (s.phase === "voting" && now >= s.deadline) {
    closeVote(s, now);
    return true;
  }
  return false;
}
export function checkEffect(s, effect) {
  if (!effect) return null;
  const e = {
    key: clean(effect.key, 32).toLowerCase(),
    value: clean(effect.value, 100),
  };
  if (!/^[a-z][a-z0-9_ -]*$/.test(e.key))
    fail("Fact keys must start with a letter.");
  const fact = s.facts.find((f) => f.key === e.key);
  if (fact?.locked && fact.value !== e.value)
    fail(`Continuity lock: ${e.key} must remain “${fact.value}”.`);
  if (!fact && s.facts.length >= 20) fail("The fact ledger holds 20 facts.");
  return e;
}
export function ingest(
  s,
  { userId, author, text, messageId, source = "twitch" },
  now = Date.now(),
) {
  tick(s, now);
  if (!userId || !messageId || s.seen.includes(messageId)) return false;
  s.seen.push(messageId);
  s.seen = s.seen.slice(-2000);
  if (s.banned.includes(userId) || typeof text !== "string") return false;
  const vote = text.trim().match(/^!vote\s+([1-4])$/i);
  if (vote && s.phase === "voting") {
    const p = s.proposals.filter((p) => p.status === "approved")[
      Number(vote[1]) - 1
    ];
    if (!p) return false;
    s.votes[userId] = p.id;
    return true;
  }
  const twist = text.trim().match(/^!twist\s+(.+)$/i);
  if (!twist || s.phase !== "collecting") return false;
  let content;
  try {
    content = clean(twist[1]);
  } catch {
    return false;
  }
  if (s.blockedTerms.some((t) => content.toLowerCase().includes(t)))
    return false;
  if (s.proposals.some((p) => p.userId === userId) || s.proposals.length >= 50)
    return false;
  s.proposals.push({
    id: randomUUID(),
    order: s.proposals.length,
    text: content,
    author: clean(author, 40),
    userId,
    messageId,
    source,
    status: "pending",
    effect: null,
  });
  log(s, `New twist from ${author}.`, now);
  return true;
}
export function command(s, action, payload = {}, now = Date.now()) {
  tick(s, now);
  const p = s.proposals.find((p) => p.id === payload.id);
  switch (action) {
    case "approve":
      if (s.phase !== "collecting" || !p || p.status !== "pending")
        fail("Only pending twists can be approved while collecting.");
      if (s.proposals.filter((p) => p.status === "approved").length >= 4)
        fail("Choose up to four twists.");
      p.effect = checkEffect(s, payload.effect);
      p.status = "approved";
      log(s, `Approved ${p.author}’s twist.`, now);
      break;
    case "reject":
      if (s.phase !== "collecting" || !p)
        fail("Twists can only be removed while collecting.");
      p.status = "rejected";
      break;
    case "ban": {
      if (!p) fail("Twist not found.");
      if (!s.banned.includes(p.userId)) s.banned.push(p.userId);
      if (s.phase === "collecting")
        s.proposals
          .filter((x) => x.userId === p.userId)
          .forEach((x) => (x.status = "rejected"));
      delete s.votes[p.userId];
      log(s, `Blocked ${p.author} from future participation.`, now);
      break;
    }
    case "open": {
      if (s.phase !== "collecting") fail("Start the next scene first.");
      if (s.proposals.filter((p) => p.status === "approved").length < 2)
        fail("Approve at least two twists.");
      const seconds = Number(payload.seconds ?? 45);
      if (!Number.isInteger(seconds) || seconds < 10 || seconds > 300)
        fail("Vote duration must be 10–300 seconds.");
      s.phase = "voting";
      s.deadline = now + seconds * 1000;
      s.votes = {};
      log(s, "Chat voting is open.", now);
      break;
    }
    case "close":
      closeVote(s, now);
      break;
    case "commit": {
      if (s.phase !== "revealed" || !s.winnerId)
        fail("Reveal a winner before making it canon.");
      const winner = s.proposals.find((p) => p.id === s.winnerId);
      const effect = checkEffect(s, winner.effect);
      if (effect) {
        const f = s.facts.find((f) => f.key === effect.key);
        if (f) f.value = effect.value;
        else s.facts.push({ ...effect, locked: false });
      }
      s.canon.push({
        round: s.round,
        text: winner.text,
        author: winner.author,
        at: now,
        effect,
      });
      s.canon = s.canon.slice(-12);
      s.phase = "canon";
      log(s, "The winning twist is now canon.", now);
      break;
    }
    case "next":
      if (!["revealed", "canon"].includes(s.phase))
        fail("Finish this scene before starting another.");
      s.history.push({
        round: s.round,
        winnerId: s.winnerId,
        committed: s.phase === "canon",
        votes: Object.keys(s.votes).length,
      });
      s.history = s.history.slice(-30);
      s.round++;
      s.phase = "collecting";
      s.prompt = clean(payload.prompt, 240);
      s.proposals = [];
      s.votes = {};
      s.deadline = null;
      s.winnerId = null;
      log(s, "A new scene begins.", now);
      break;
    case "scene":
      if (s.phase !== "collecting")
        fail("Edit the scene while collecting twists.");
      s.title = clean(payload.title, 60);
      s.prompt = clean(payload.prompt, 240);
      break;
    case "fact": {
      if (s.phase !== "collecting") fail("Edit facts before voting.");
      const e = checkEffect(s, payload);
      const f = s.facts.find((f) => f.key === e.key);
      if (f) {
        f.value = e.value;
        f.locked = payload.locked === true;
      } else s.facts.push({ ...e, locked: payload.locked === true });
      break;
    }
    case "unlock":
      if (s.phase !== "collecting") fail("Unlock facts before voting.");
      {
        const f = s.facts.find((f) => f.key === payload.key);
        if (!f) fail("Fact not found.");
        f.locked = false;
      }
      break;
    case "terms":
      if (!Array.isArray(payload.terms) || payload.terms.length > 30)
        fail("Use up to 30 blocked terms.");
      s.blockedTerms = payload.terms.map((t) => clean(t, 40).toLowerCase());
      break;
    default:
      fail("Unknown action.");
  }
  return s;
}
