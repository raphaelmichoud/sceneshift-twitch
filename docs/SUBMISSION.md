# Submission checklist and human-only actions

Official rules checked October 26, 2026: https://twitchcon-codex.devpost.com/rules

**Deadline: November 2, 2026 at 14:00 Pacific / 23:00 Europe/Zurich (22:00 UTC).** Aim to finish the recording by October 30, upload by October 31, and submit by November 1. The official rules govern eligibility and deadlines; the entrant must personally confirm their eligibility and agreement.

## Prepared

- [x] Newly created project in a dedicated Codex build thread, begun October 26, within the October 23–November 2 submission window.
- [x] Full source, original CSS/SVG visuals, MIT license, README, environment-variable reference, no runtime dependencies.
- [x] Deterministic voting, moderation queue, permissions, continuity effects, streamer-controlled canon.
- [x] Real Twitch OAuth/EventSub implementation and separate local rehearsal.
- [x] Automated tests and a browser-exercised end-to-end rehearsal.
- [x] Deployment recipe, Devpost English story, and a 2:40 English demo plan.
- [x] Codex build session ID: `01a17901-b64d-7043-9268-af05e280ce91`.

## Account-bound steps to complete

### 1. Twitch developer registration and authorization

The account owner must sign in, complete verification/CAPTCHA if prompted, register the app, and authorize chat reading. Follow README. Store the client ID and secret in the local `.env`; do not send the secret in chat. Use redirect URI `http://localhost:3000/auth/callback` for the running local app. After restarting the app, unlock Studio → Settings → Connect Twitch and approve `user:read:chat` as the broadcaster.

### 2. Live verification — do not check these until observed

- [ ] Correct connected channel appears in the studio.
- [ ] A real Twitch `!twist` appears privately; unapproved text is absent from `/overlay`.
- [ ] Two real viewer suggestions are approved and voting opens.
- [ ] A real Twitch `!vote` changes the count in the overlay; a second vote by the same account changes the choice without increasing total votes.
- [ ] The winner is revealed and becomes canon only after explicit approval.
- [ ] The next scene preserves the canon and locked facts.
- [ ] The OBS browser source is visible in the actual Twitch stream output.
- [ ] Record one live proof sequence; note date/channel and observed outcome in VERIFICATION.md.

### 3. Repository visibility and judge access

Repository: https://github.com/raphaelmichoud/sceneshift-twitch

The prepared remote is private until the owner approves publication. The rules require an accessible GitHub/GitLab/Bitbucket repository with full source and run instructions. **Before final submission**, either make it public or share the private GitHub/GitLab repository with the exact judge address shown on the rules page. The scraped address is obfuscated; read it directly rather than guessing. Public source under the included MIT license is the straightforward route once approved.

- [ ] Review source and docs, including names and screenshots.
- [ ] Confirm no `.env`, `data/`, tokens, private key, or unrelated files are tracked.
- [ ] Approve/make repository public or configure official judge access.
- [ ] Confirm repository clone and README work while signed out (if public).
- [ ] Keep source and testing free and available through the end of judging, November 15, 2026 at 17:00 Pacific (November 16 at 02:00 Zurich).

### 4. Record and upload

Follow DEMO.md. The video should be **less than three minutes**, show the project functioning on Twitch, and show how it was built with Codex. The rules require **public YouTube visibility**, not just an unlisted link.

- [ ] Record real Twitch proof and Codex build footage.
- [ ] Record English narration and trim to 2:40–2:50.
- [ ] Use only assets/music/trademarks you have permission to include; original app artwork and no music simplify this.
- [ ] Upload through the owner’s YouTube account; complete any verification personally.
- [ ] Set visibility Public and verify the video link signed out.

### 5. Final Devpost submission

The entrant personally joins/registers, confirms eligibility, agrees to the rules, and submits. These account/identity/terms actions are not performed automatically.

- [ ] Sign in at https://twitchcon-codex.devpost.com and join the hackathon.
- [ ] Create the SceneShift submission and paste the story from DEVPOST.md, updating any statements to match final verified functionality.
- [ ] Add repository URL, public YouTube URL, screenshots, platform “Node.js 22 + modern browser + OBS; macOS/Windows/Linux”, run instructions, and build tools.
- [ ] Enter **this build chat’s session ID**, not the source coordinator chat: `01a17901-b64d-7043-9268-af05e280ce91`.
- [ ] Recheck any required form fields and testing instructions; make the project free to test.
- [ ] Submit by November 2 at 23:00 Zurich; save the confirmation URL and timestamp.

## Optional public test deployment

No permanent public URL has been deployed yet. Local rehearsal is complete and does not require a paid service. A hosted test link is optional; follow DEPLOYMENT.md if you want one. Keep a public shared rehearsal separate from the real channel’s private studio and token data.
