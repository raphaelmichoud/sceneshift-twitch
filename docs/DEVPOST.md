# Devpost-ready project story

## Project name
SceneShift

## Tagline
Your story. Their plot twist. A Twitch writers’ room that lets chat change the story while the streamer keeps the canon.

## Inspiration
The best improv streams feel like a story the whole room is telling together. But a busy chat is a difficult writers’ room: good ideas disappear, competing suggestions derail a scene, and yesterday’s story gets forgotten. We wanted the audience to have a visible creative role without asking the streamer to surrender the plot.

SceneShift turns that energy into a simple ritual: propose a twist, curate the possibilities, vote, reveal, and decide what becomes canon.

## What it does
Viewers propose short story twists using `!twist` in Twitch chat. Suggestions enter a private queue. The streamer approves two to four choices, optionally attaching a structured continuity fact to each. A dedicated OBS browser overlay shows those choices and a timed vote. Viewers use `!vote 1`, `!vote 2`, and so on; a viewer can change their mind, but still gets only one vote.

The winning twist becomes a broadcast moment. It becomes part of the persistent canon only when the streamer explicitly approves it. Locked facts protect structured continuity changes, while a compact chapter ledger helps the streamer remember what the audience has already written. The streamer reviews the prose: SceneShift does not pretend that a small fact engine understands every narrative contradiction.

A labeled rehearsal room exercises the same application rules with simulated chat, so judges can try the complete experience without an account or API key. Real Twitch mode uses broadcaster-authorized EventSub chat events. The two input modes cannot be mixed during a live connection.

## How we built it
We built SceneShift from a new, empty project during the hackathon using OpenAI Codex in one dedicated build thread: `01a17901-b64d-7043-9268-af05e280ce91`.

Codex implemented the deterministic state engine, Twitch OAuth and EventSub integration, HTTP server, live state updates, original overlay artwork, studio interface, automated tests, and documentation. It also exercised the rehearsal through the browser and used failures to tighten authorization and overlay privacy. The source history and verification notes document the result.

The application uses Node.js 22 and native browser technologies, with no runtime npm dependencies. A single authoritative server owns voting and timing; browsers receive a public or authenticated projection through server-sent events. State is persisted by atomic filesystem writes. Twitch access tokens stay on the server, and the overlay cannot see the moderation queue.

There is no runtime generative AI. The community supplies the creativity; Codex supplied the development assistance. Votes, permissions, continuity checks, moderation decisions, and transitions are deterministic application code.

## Challenges we ran into
A live audience needs clarity about when it has influence. We made the phases explicit, fixed option numbers during voting, and separated winning a vote from becoming canon. Twitch moderation can remove a message mid-scene, so the integration cancels an affected uncommitted vote rather than silently changing the result. Reconnection also needs honest UI: Twitch does not replay chat lost during an outage, so the studio exposes connection status.

The overlay and studio share the same server, but they must not share the same visibility. The overlay explicitly requests the public projection even in a signed-in browser, keeping unapproved suggestions off stream.

## Accomplishments that we’re proud of
A small, understandable interaction creates a complete shared storytelling loop. The reveal is designed as a broadcast moment, the streamer remains in control, and the canon remembers the audience’s contribution. Rehearsal makes the project easy to explore, and the automated suite checks the rules that would be hardest to explain after a live mistake: duplicate votes, ties, deadlines, locked facts, and authorization.

## What we learned
Reliability is a creative feature. When the voting rules are visible and the streamer can trust the controls, the room can concentrate on the story. We also learned to be precise about AI: using Codex to build a creative tool does not require giving a model authority over the audience or the story.

## What’s next
Test with narrative streamers, refine the pace of the reveal, and explore optional recap assistance with clearly labeled suggestions and explicit streamer acceptance. Any future model-assisted feature would preserve the deterministic voting engine and keep a no-model path available.

## Built with
OpenAI Codex, JavaScript, Node.js 22, Twitch OAuth, Twitch EventSub WebSockets, HTML, CSS, server-sent events, Node test runner, OBS browser source.

## Links and verification before submission
Repository: https://github.com/raphaelmichoud/sceneshift-twitch (make public or grant the official judges access before submitting).

Build thread/session: `01a17901-b64d-7043-9268-af05e280ce91`.

YouTube: add the final **public** video URL after recording and upload.

Testing: README contains a zero-credential rehearsal and real Twitch instructions. Before pasting this story into the final submission, complete the real Twitch checklist and ensure the video demonstrates the live functionality described here. See VERIFICATION.md for current evidence; do not imply an unperformed live test has passed.
