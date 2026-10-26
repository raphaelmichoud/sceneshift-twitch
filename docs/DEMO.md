# English demo — target 2:40, hard stop before 3:00

Record at 1920 × 1080. Use your own voice, original app visuals, and no background music. Keep secrets, studio key, account settings, and private chats out of frame. Rehearse once locally, then capture **real Twitch chat and the overlay on a Twitch stream** for the final video. A chat-only simulation is not sufficient for the requested footage.

## Recording setup

- Register and authorize Twitch first. Run the live verification in SUBMISSION.md.
- Prepare OBS with your camera/video source plus the SceneShift browser overlay. Show the output actually on your Twitch channel; capture the channel player and chat together for the proof shot. Avoid unrelated emotes, logos, music, or third-party footage where possible; obtain permissions where needed under the competition rules.
- Use two or three participating Twitch accounts/viewers who agree to their chat names appearing. One person can test commands, but distinct real viewers make the value clearer. Never create deceptive fake live activity.
- Use a fresh scene, title “The Last Lighthouse,” and the default prompt. Have viewers ready with the three sample texts below. Keep a separate rehearsal instance if you need practice; never use simulated counts as live proof.
- Set voting to 15 seconds. During the recording, send enough real votes to produce a clear winner. Counts in narration should match the recording; do not promise the rehearsal’s 6–4–2 result.
- Keep Codex’s build chat and the test result available for the final proof shot. The thread ID is safe to show; credentials are not.

## Timed script and shot list

| Time | Footage | English narration |
|---|---|---|
| 0:00–0:15 | Full overlay, then a quick studio glimpse. | “This is SceneShift: your story, their plot twist. It turns Twitch chat into a writers’ room for role-play, narrative, and improv streams—while the streamer keeps the pen.” |
| 0:15–0:35 | Twitch channel player and chat. Show a real `!twist` being sent and appearing in the private queue. | “Our lighthouse has gone dark, and something is knocking inside the lens. Viewers pitch what happens next with one chat command. Their ideas land in a private queue, so nothing goes on stream before I review it.” |
| 0:35–0:55 | Approve two or three real proposals. Add `lens` → `A tiny storm lives inside` to the storm option. | “I choose the possibilities. This viewer thinks the lens hatches a storm. I can attach a continuity fact, and locked facts can’t be overwritten. The story text still gets a human review.” |
| 0:55–1:20 | Click Open the vote. Show Twitch chat `!vote 2` and the Twitch player’s overlay updating. | “Now chat writes the next beat. Everyone gets one vote, and changing your vote replaces your previous choice. The server owns the countdown and the count. We use real Twitch EventSub messages, not a poll animation.” |
| 1:20–1:40 | Countdown expires and winner reveals on the live stream. | “Chat has spoken. The twist wins the vote, but it hasn’t rewritten the story yet. I can accept it or move on. That separation keeps audience participation fun without letting a vote hijack the stream.” |
| 1:40–2:00 | Click Make this canon, open Canon tab, then start a next scene. | “I make it canon. The chapter and its fact enter the ledger, and they survive into the next scene. The audience sees its contribution become part of a story that remembers.” |
| 2:00–2:18 | Briefly show a separate labeled rehearsal instance, or the checked-in rehearsal instructions. | “There’s also a clearly labeled rehearsal mode. Judges can run this whole loop locally without Twitch credentials or an AI key. It uses the same voting rules, with simulated viewers explicitly marked.” |
| 2:18–2:35 | Show this Codex build thread, source files, and passing test results. | “I built this new project with OpenAI Codex in this dedicated thread. Codex implemented the interface, Twitch integration, and tests. Permissions, voting, moderation, and continuity rules are deterministic code. There is no runtime generative AI.” |
| 2:35–2:40 | Return to the overlay with final canon result. | “SceneShift. A little chaos. A lot of story.” |

## Viewer text for rehearsal and recording

1. `!twist The knocking is Mara’s future self, warning her not to relight the beacon.`
2. `!twist The lens hatches a tiny storm that recognizes Mara as its keeper.`
3. `!twist Every ship lost at sea is waiting on the other side of the glass.`

If viewers submit in a different order, vote for the correct visible number. Option numbers follow submission order among approved choices. Say the observed winner, not a predetermined claim.

## Edit checklist

- Total length 2:40–2:50. No intro bumper needed.
- Include uninterrupted real chat → count change → live Twitch overlay footage.
- Include visible Codex build footage; a verbal mention alone does not show the build.
- English narration or accurate English translation/subtitles.
- Describe rehearsal as simulation. Never cut between rehearsal counts and live chat as if they were one run.
- Verify frame readability at normal YouTube size; linger 2–3 seconds on key buttons.
- Upload to YouTube with **Public** visibility, as required by the rules. Test the link signed out.
- Suggested title: “SceneShift — Your story. Their plot twist. | Codex x TwitchCon Hackathon”.
- Suggested description: “SceneShift is a Twitch writers’ room with viewer-proposed story twists, deterministic chat voting, a live OBS overlay, and streamer-approved canon. Built from scratch with OpenAI Codex. Source and local demo instructions: https://github.com/raphaelmichoud/sceneshift-twitch”.
