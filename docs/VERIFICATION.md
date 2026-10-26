# Verification record — October 26, 2026

## Passed

- `npm run check`: syntax validation for server, state engine, Twitch adapter, and browser application.
- `npm test`: **20 tests pass**, including a spawned real HTTP server, private studio login, CSRF-origin rejection, unauthorized command rejection, private pending queue, public overlay projection, proposal approval, replacement voting, reveal, canon commit, duplicate commit rejection, export, restart persistence, and session invalidation on logout.
- State tests: bounds/filtering, duplicate message handling, one proposal per viewer, latest valid vote, ties, zero votes, authoritative deadline, phase rules, local bans, structured continuity locks, explicit canon commit, and next scene.
- Mocked Twitch adapter tests: token validation, four read-only EventSub subscriptions, broadcaster filtering, migration without duplicate resubscription, revocation shutdown, allowed reconnect host, and wrong-broadcaster rejection.
- Twitch-event bridge tests: chat-message vs notification IDs, replay/stale/malformed timestamp rejection, Shared Chat origin filtering, deletion canceling an active result, removal of a cleared viewer’s ballot, and preservation of streamer-approved canon.
- Browser rehearsal in the Codex in-app browser: unlocked the local studio, added three labeled sample twists, approved all three, attached `lens → A tiny storm lives inside`, opened a vote, simulated 12 viewers, observed **4 / 6 / 2** counts, revealed the storm as winner, explicitly committed it, and observed both chapter and fact in the ledger.
- Browser next-scene transition also passed: scene 02 opened with the storm chapter and lens fact preserved.
- GitHub Actions independently passed the syntax checks and full test suite on Linux: https://github.com/raphaelmichoud/sceneshift-twitch/actions/runs/40360595736
- Separate `/overlay` browser tab showed the committed result with no studio controls and explicit **REHEARSAL · SIMULATED CHAT** labeling. Screenshots: `studio-preview.png` and `overlay-preview.png`.
- Source prepared without external images/fonts/music, runtime npm packages, or committed credentials. Native runtime data is ignored by Git.

## Pending — do not describe these as completed

- Actual Twitch application registration and broadcaster OAuth consent.
- Real Twitch chat delivery, real production token refresh, and production reconnection under an actual outage. These paths have mocked coverage, not live-service proof.
- An OBS browser source displayed in a real Twitch stream; this is required footage for the intended hackathon demo.
- Docker image build and a permanent public hosting deployment. The deployment recipe is prepared; no public test URL is claimed.
- Mobile viewport QA and OBS-specific browser engine QA. Responsive styles are implemented; the verified browser viewport was 1280 × 720.
- Public GitHub visibility / judge access, public YouTube recording/upload, and final Devpost submission.

## Live proof record to fill after authentication

- Date/time and channel:
- Observed Twitch `!twist` → pending queue:
- Observed Twitch `!vote` → count / replacement behavior:
- OBS overlay visible on Twitch:
- Observed winner / canon / next scene:
- Recording or public video URL:

Keep secrets and access tokens out of this record. Update this file after the actual live run and before final submission.
