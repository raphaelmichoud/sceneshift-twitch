# Architecture and primary references

```
Twitch chat → EventSub WebSocket → authenticated broadcaster filter
                                       ↓
Rehearsal chat → same parser → deterministic state engine → atomic state file
                                       ↓
                      streamer commands (session + exact Origin)
                                       ↓
                     SSE public/private projection → studio / OBS overlay
```

`src/engine.js` owns phase transitions, text limits, moderation, per-user votes, deadlines, winner selection, fact effects, and canon. It has no model/network dependency. `src/twitch.js` owns token validation/refresh and the EventSub lifecycle, with injectable transport for testing. `src/server.js` owns HTTP, sessions, persistence, OAuth state, projection, and ingestion. `public/app.js` renders the studio/overlay and sends commands; it cannot decide a result locally.

One server process, one channel, filesystem persistence. Runtime Twitch credentials are private files, not a browser token. OAuth state is random, short-lived, one-use, and tied to the initiating studio session. Lax cookies allow the top-level Twitch callback; exact-Origin checks protect state-changing requests. Reconnecting does not invent lost chat events. The watch timer closes unhealthy sockets; standard WebSocket ping/pong is handled by Node’s implementation. Migrations keep the old socket until the replacement welcome. Duplicate messages and old notifications are rejected before voting.

There is no runtime AI or external asset request. Original art uses CSS and an SVG favicon. CSS fonts are system fonts. Future suggestion features must be distinctly labeled, untrusted, optional, and streamer-reviewed; they must never control the vote engine.

## Primary sources consulted October 26, 2026

- Official rules: https://twitchcon-codex.devpost.com/rules
- Twitch chat overview: https://dev.twitch.tv/docs/chat/
- Authorization code flow: https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#authorization-code-grant-flow
- EventSub WebSockets (welcome, subscription, keepalive, reconnect, revocation): https://dev.twitch.tv/docs/eventsub/handling-websocket-events/
- Chat message / deletion / clear subscription types and scopes: https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatmessage
- Duplicate-event guidance: https://dev.twitch.tv/docs/eventsub/#handling-duplicate-events

The live adapter uses `channel.chat.message`, `channel.chat.message_delete`, `channel.chat.clear_user_messages`, and `channel.chat.clear`, version 1. With a user access token and `user:read:chat`, the broadcaster is both `broadcaster_user_id` and `user_id`. No app-token bot scopes are requested.
