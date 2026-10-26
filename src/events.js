import { ingest, log } from "./engine.js";
export function applyTwitchEvent(state, type, e, m, now = Date.now()) {
  const time = Date.parse(m.message_timestamp);
  if (
    !Number.isFinite(time) ||
    state.seen.includes(m.message_id) ||
    now - time > 600000 ||
    time > now + 60000
  )
    return false;
  if (type === "channel.chat.message") {
    if (
      e.source_broadcaster_user_id &&
      e.source_broadcaster_user_id !== e.broadcaster_user_id
    )
      return false;
    ingest(
      state,
      {
        userId: e.chatter_user_id,
        author: e.chatter_user_name,
        text: e.message.text,
        messageId: e.message_id,
      },
      now,
    );
    if (!state.seen.includes(m.message_id)) state.seen.push(m.message_id);
    state.seen = state.seen.slice(-2000);
  } else {
    state.seen.push(m.message_id);
    state.seen = state.seen.slice(-2000);
    const affected = state.proposals.filter(
      (p) =>
        type === "channel.chat.clear" ||
        (type === "channel.chat.message_delete"
          ? p.messageId === e.message_id
          : p.userId === e.target_user_id),
    );
    if (
      affected.length &&
      ["collecting", "voting", "revealed"].includes(state.phase)
    ) {
      if (state.phase !== "collecting") {
        state.phase = "revealed";
        state.winnerId = null;
        state.deadline = null;
        state.votes = {};
      }
      affected.forEach((p) => {
        p.status = "rejected";
        p.text = "[Removed by Twitch moderation]";
      });
      log(
        state,
        "Twitch moderation removed a twist. Any active result was canceled.",
        now,
      );
    }
    if (type === "channel.chat.clear_user_messages")
      delete state.votes[e.target_user_id];
    if (type === "channel.chat.clear") state.votes = {};
  }
  return true;
}
