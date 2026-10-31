const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const overlay = location.pathname === "/overlay";
let state,
  admin = false,
  stream,
  offset = 0,
  tab = "queue";
const phaseName = {
  collecting: "Collecting twists",
  voting: "Chat is writing",
  revealed: "The plot thickens",
  canon: "Written into canon",
};
const phaseHint = {
  collecting: "Every great story needs a little chaos.",
  voting: "One viewer. One vote. Endless possibilities.",
  revealed: "Chat has spoken. You hold the pen.",
  canon: "A new truth. A story that remembers.",
};
async function api(path, body) {
  const r = await fetch(
    path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Request failed.");
  return data;
}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("show"), 4500);
}
function adopt(s) {
  state = s;
  offset = s.serverTime - Date.now();
  admin = Array.isArray(s.activity);
  render();
}
function events() {
  stream?.close();
  stream = new EventSource("/api/events" + (overlay ? "?public=1" : ""));
  stream.onmessage = (e) => {
    adopt(JSON.parse(e.data));
    $("#sync")?.classList.remove("offline");
  };
  stream.onerror = () => {
    $("#sync")?.classList.add("offline");
  };
}
function options() {
  return state.proposals.filter((p) => overlay || p.status === "approved");
}
function badge() {
  return `<span class="mode ${state.twitch.state === "connected" ? "live" : ""}"><i></i>${state.twitch.state === "connected" ? `Twitch · ${esc(state.twitch.channel)}` : state.twitch.state === "disconnected" ? "Rehearsal mode" : `Twitch · ${esc(state.twitch.state)}`}</span>`;
}
function stage() {
  const opts = options(),
    winner = opts.find((p) => p.id === state.winnerId),
    total = state.totalVotes;
  return `<section class="stage ${state.phase}" aria-label="Stream overlay preview"><div class="stage-top"><span class="eyebrow">THE WRITERS’ ROOM</span><span class="scene-number">SCENE ${String(state.round).padStart(2, "0")}</span></div><div class="story-art" aria-hidden="true"><div class="moon"></div><div class="beam"></div><div class="tower"></div><div class="island"></div><div class="waves"></div><span class="coordinate">47° N / 08° E<br>GREYWAKE ISLAND</span></div><div class="stage-story"><span class="genre">A COMMUNITY-WRITTEN MYSTERY</span><h1>${esc(state.title)}</h1><p class="prompt">${esc(state.prompt)}</p></div><div class="decision"><div class="decision-heading"><span class="status-dot"></span><h2>${phaseName[state.phase]}</h2><span class="countdown" id="countdown">${state.phase === "voting" ? "" : state.phase === "canon" ? "CANON LOCKED" : "✦"}</span></div>${winner ? `<div class="winner"><span class="eyebrow">${state.phase === "canon" ? "NOW PART OF THE STORY" : "CHAT’S CHOICE"}</span><h3>${esc(winner.text)}</h3><p>Twist by <strong>${esc(winner.author)}</strong> · ${winner.votes} vote${winner.votes === 1 ? "" : "s"}</p></div>` : state.phase === "revealed" ? '<div class="waiting"><strong>No result this scene.</strong><span>The streamer can open a new scene.</span></div>' : opts.length ? `<div class="choices">${opts.map((p, i) => `<div class="choice"><span class="choice-key">${i + 1}</span><div><strong>${esc(p.text)}</strong><small>by ${esc(p.author)}</small><progress class="vote-track" max="100" value="${total ? (p.votes / total) * 100 : 0}" aria-label="Vote share"></progress></div><span class="vote-count">${state.phase === "voting" ? p.votes : "↗"}</span></div>`).join("")}</div>` : '<div class="waiting"><span class="spark">✧</span><strong>Your next plot twist starts in chat.</strong><span>The streamer is curating the possibilities.</span></div>'}<div class="chat-instruction"><code>${state.phase === "collecting" ? "!twist your idea" : state.phase === "voting" ? "!vote 1 · !vote 2 · !vote 3 · !vote 4" : "THE STORY CONTINUES"}</code><span>${state.phase === "voting" ? `${total} votes · latest vote counts` : state.phase === "collecting" ? "Propose in Twitch chat" : "Streamer decides what becomes canon"}</span></div></div><div class="canon-strip"><span>⌁ CANON</span><p>${esc(state.canon.at(-1)?.text || "Mara keeps the lighthouse on Greywake Island. The light must return.")}</p></div><div class="stage-footer"><span class="mini-brand">SceneShift <b>↗</b></span><span>${state.twitch.state === "disconnected" ? "REHEARSAL · SIMULATED CHAT" : state.twitch.state === "connected" ? "TWITCH CHAT · LIVE STORY" : "TWITCH DISCONNECTED · CHECK STUDIO"}</span></div></section>`;
}
function queue() {
  const pending = state.proposals.filter((p) => p.status === "pending"),
    approved = state.proposals.filter((p) => p.status === "approved");
  return `<div class="panel-heading"><div><span class="eyebrow">YOU HOLD THE PEN</span><h2>Curate the chaos<span>${pending.length}</span></h2></div><span class="soft-tag">${approved.length}/4 on stage</span></div><p class="muted">Approve 2–4 twists, then let chat choose. Pending ideas stay off the overlay.</p><div class="queue">${pending.length ? pending.map((p) => `<article class="proposal"><div class="proposal-author"><span class="avatar">${esc(p.author[0].toUpperCase())}</span><strong>${esc(p.author)}</strong><span>${p.source === "rehearsal" ? "REHEARSAL" : "TWITCH"}</span></div><p>${esc(p.text)}</p><form class="approve-form" id="approve-${p.id}" data-id="${p.id}"><details><summary>Attach a canon fact <span>optional</span></summary><div class="two-fields"><input name="key" placeholder="Fact key, e.g. lens" maxlength="32" aria-label="Fact key"><input name="value" placeholder="New value" maxlength="100" aria-label="Fact value"></div><small>Locked facts cannot change. Story text still needs your review.</small></details><div class="proposal-actions"><button class="approve" ${state.phase !== "collecting" ? "disabled" : ""}>＋ Approve</button><button type="button" data-action="reject" data-id="${p.id}" class="quiet" ${state.phase !== "collecting" ? "disabled" : ""}>Dismiss</button><button type="button" data-action="ban" data-id="${p.id}" class="icon-button" aria-label="Block ${esc(p.author)}">⊘</button></div></form></article>`).join("") : `<div class="empty"><span>✦</span><h3>A little quiet before the twist.</h3><p>${approved.length ? "Your approved twists are on stage. Add more or open voting." : "Try the rehearsal chat below, or connect your Twitch channel."}</p></div>`}</div>${approved.length ? `<div class="approved-list"><span class="eyebrow">ON STAGE</span>${approved.map((p, i) => `<div><span>${i + 1}</span><p>${esc(p.text)}${p.effect ? `<small>${esc(p.effect.key)} → ${esc(p.effect.value)}</small>` : ""}</p>${state.phase === "collecting" ? `<button class="quiet" data-action="reject" data-id="${p.id}" aria-label="Remove option ${i + 1}">×</button>` : ""}</div>`).join("")}</div>` : ""}`;
}
function ledger() {
  return `<div class="panel-heading"><div><span class="eyebrow">A STORY THAT REMEMBERS</span><h2>Continuity ledger</h2></div><a class="text-link" href="/api/export">Export ↗</a></div><p class="muted">Locked facts reject conflicting structured changes. You review the prose.</p><div class="facts">${state.facts.map((f) => `<div><span>${esc(f.key)}</span><strong>${esc(f.value)}</strong>${f.locked ? `<button class="fact-lock" data-action="unlock" data-key="${esc(f.key)}" ${state.phase !== "collecting" ? "disabled" : ""} title="Unlock fact">▣ Locked</button>` : "<small>Editable</small>"}</div>`).join("")}</div><form id="fact-form"><div class="two-fields"><input name="key" required placeholder="Fact key" maxlength="32" aria-label="New fact key"><input name="value" required placeholder="Fact value" maxlength="100" aria-label="New fact value"></div><label class="check"><input type="checkbox" name="locked" checked> Lock this fact</label><button class="secondary" ${state.phase !== "collecting" ? "disabled" : ""}>Save fact</button></form><h3 class="ledger-heading">What happened so far</h3>${
    state.canon.length
      ? state.canon
          .slice()
          .reverse()
          .map(
            (c) =>
              `<article class="canon-entry"><span>SCENE ${String(c.round).padStart(2, "0")}</span><p>${esc(c.text)}</p><small>Proposed by ${esc(c.author)} · approved by streamer</small></article>`,
          )
          .join("")
      : '<p class="muted">The first chapter is waiting to be written.</p>'
  }`;
}
function settings() {
  return `<div class="panel-heading"><div><span class="eyebrow">SET THE SCENE</span><h2>Room settings</h2></div></div><form id="scene-form"><label>Story title<input name="title" value="${esc(state.title)}" maxlength="60" required></label><label>Current scene<textarea name="prompt" maxlength="240" required>${esc(state.prompt)}</textarea></label><button class="secondary" ${state.phase !== "collecting" ? "disabled" : ""}>Save scene</button></form><hr><h3>Twitch connection</h3><p class="muted">Connect as the broadcaster. SceneShift reads chat; it never sends messages or moderates your channel.</p><p class="connection-detail">${esc(state.twitch.detail || "Start an empty scene before connecting a live channel.")}</p><div class="row"><a class="secondary button" href="/auth/twitch">Connect Twitch ↗</a><button class="quiet" id="disconnect">Disconnect</button></div><hr><form id="terms-form"><label>Blocked phrases <span class="muted">one per line</span><textarea name="terms" placeholder="Phrases to filter from incoming proposals">${esc(state.blockedTerms.join("\n"))}</textarea></label><button class="secondary">Save filter</button></form><p class="muted">Case-insensitive phrase matching. This is a small local filter, not a full safety classifier. Every twist requires your approval.</p><hr><button id="reset" class="quiet danger">Reset rehearsal…</button><button id="logout" class="quiet">Lock studio</button>`;
}
function controls() {
  let action = "";
  if (state.phase === "collecting")
    action = `<div class="vote-duration"><label for="duration">Vote length</label><select id="duration"><option value="45">45 seconds</option><option value="15">15 seconds</option><option value="90">90 seconds</option><option value="300">5 minutes (test)</option></select></div><button class="primary" id="open" ${options().length < 2 ? "disabled" : ""}>Open the vote <span>↗</span></button>`;
  else if (state.phase === "voting")
    action =
      '<p class="muted">Votes close automatically. Ties favor the first approved option in stage order.</p><button class="primary" data-action="close">Close & reveal ↗</button>';
  else
    action = `${state.phase === "revealed" && !state.winnerId && !state.totalVotes && options().length >= 2 ? '<button class="primary" data-action="retry">Retry vote · 5 minutes ↗</button>' : ""}${state.phase === "revealed" && state.winnerId ? '<button class="primary mint" data-action="commit">✦ Make this canon</button>' : ""}<form id="next-form"><label>Next scene prompt<textarea name="prompt" placeholder="The lens cracks open. What does Mara find?" maxlength="240" required></textarea></label><button class="secondary">${state.phase === "canon" ? "Start next scene ↗" : "Skip result & start next scene ↗"}</button></form>`;
  return `<div class="round-controls"><span class="eyebrow">DIRECTOR’S CUE</span>${action}</div>`;
}
function rehearsal() {
  return `<section class="rehearsal"><div><span class="eyebrow">NO AUDIENCE REQUIRED</span><h2>Rehearsal chat</h2><p>Try the exact commands your viewers will use.</p></div><div class="rehearsal-buttons"><button class="secondary" id="sample" ${state.phase !== "collecting" || state.twitch.state !== "disconnected" ? "disabled" : ""}>＋ Add three sample twists</button><button class="secondary" id="sample-votes" ${state.phase !== "voting" || state.twitch.state !== "disconnected" ? "disabled" : ""}>Simulate 12 viewers ↗</button></div><form id="chat-form"><input name="user" value="storyfan" maxlength="25" aria-label="Simulated viewer name" required><input name="text" placeholder="!twist The lighthouse is a sleeping giant" aria-label="Simulated chat command" required maxlength="200"><button class="primary" ${state.twitch.state !== "disconnected" ? "disabled" : ""}>Send ↗</button></form><small>Simulated inputs are labeled. Disconnect Twitch to rehearse. One twist per viewer per scene; latest vote wins.</small></section>`;
}
function render() {
  if (!state) return;
  const duration = $("#duration")?.value;
  const focused = document.activeElement;
  const focusId = focused?.id;
  const formId = focused?.form?.id;
  const name = focused?.name;
  const opened = Array.from(
    document.querySelectorAll("form[id] details[open]"),
  ).map((e) => e.closest("form").id);
  const values = {};
  document.querySelectorAll("form").forEach((f) => {
    if (f.id)
      values[f.id] = Array.from(f.elements)
        .filter((e) => e.name)
        .map((e) => [e.name, e.value, e.checked]);
  });
  $("#app").innerHTML = overlay
    ? `<main class="overlay-wrap">${stage()}</main>`
    : `<header><a href="/" class="brand"><span class="brand-mark">↗</span>SceneShift<span class="brand-label">STUDIO</span></a><div class="header-right"><span id="sync" class="sync">● Synced</span>${badge()}<a href="/overlay" target="_blank" rel="noopener" class="overlay-link">Open overlay ↗</a></div></header><main><section class="intro"><div><span class="eyebrow">LET CHAT CHANGE THE STORY</span><h1>Your story. Their plot twist.</h1><p>${phaseHint[state.phase]}</p></div><div class="intro-step"><span class="${state.phase === "collecting" ? "active" : ""}">01 Curate</span><b>→</b><span class="${state.phase === "voting" ? "active" : ""}">02 Vote</span><b>→</b><span class="${["revealed", "canon"].includes(state.phase) ? "active" : ""}">03 Make canon</span></div></section><div class="workspace"><div class="broadcast"><div class="section-label"><span>◉ OVERLAY PREVIEW</span><span>OBS BROWSER SOURCE · 1920 × 1080</span></div>${stage()}${admin ? rehearsal() : `<section class="unlock"><div><span class="eyebrow">WELCOME TO THE WRITERS’ ROOM</span><h2>The audience brings the chaos.<br>You keep the story.</h2><p>Unlock the studio to curate twists, run votes, and keep a living canon.</p></div><form id="login-form"><label>Studio key<input type="password" name="key" autocomplete="current-password" required placeholder="Your private studio key"></label><button class="primary">Enter the studio ↗</button><small>Local setup: find your key in data/admin.key. See README for Twitch setup.</small></form></section>`}</div>${admin ? `<aside><div class="tabs" role="tablist"><button role="tab" aria-selected="${tab === "queue"}" data-tab="queue" class="${tab === "queue" ? "selected" : ""}">Twist queue</button><button role="tab" aria-selected="${tab === "ledger"}" data-tab="ledger" class="${tab === "ledger" ? "selected" : ""}">Canon</button><button role="tab" aria-selected="${tab === "settings"}" data-tab="settings" class="${tab === "settings" ? "selected" : ""}">Settings</button></div><section class="panel">${tab === "queue" ? queue() : tab === "ledger" ? ledger() : settings()}</section>${controls()}<details class="activity"><summary>Room activity</summary>${state.activity.map((a) => `<p><time>${new Date(a.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>${esc(a.text)}</p>`).join("")}</details></aside>` : ""}</div><footer><span>SceneShift <b>↗</b> <span>A little chaos. A lot of story.</span></span><span>Built with Codex · Powered by your community</span></footer></main>`;
  if (!overlay) {
    if (duration && $("#duration")) $("#duration").value = duration;
    for (const id of opened) {
      const d = document.getElementById(id)?.querySelector("details");
      if (d) d.open = true;
    }
    for (const [id, fields] of Object.entries(values)) {
      const f = document.getElementById(id);
      if (f)
        for (const [n, v, c] of fields) {
          const e = f.elements.namedItem(n);
          if (e) {
            e.value = v;
            e.checked = c;
          }
        }
    }
    let target = focusId
      ? document.getElementById(focusId)
      : formId
        ? document.getElementById(formId)?.elements.namedItem(name)
        : null;
    if (target) {
      target.focus({ preventScroll: true });
      if (
        target.setSelectionRange &&
        ["text", "textarea", "password"].includes(target.type)
      )
        try {
          target.setSelectionRange(
            focused.selectionStart,
            focused.selectionEnd,
          );
        } catch {}
    }
    bind();
  }
  updateTimer();
}
async function action(a, p = {}) {
  adopt(await api("/api/action", { action: a, payload: p }));
}
function submit(id, fn) {
  const f = $(id);
  if (f)
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await fn(Object.fromEntries(new FormData(f)), f);
      } catch (err) {
        toast(err.message);
      }
    });
}
function click(id, fn) {
  $(id)?.addEventListener("click", async () => {
    try {
      await fn();
    } catch (e) {
      toast(e.message);
    }
  });
}
function bind() {
  document.querySelectorAll("[data-tab]").forEach(
    (el) =>
      (el.onclick = () => {
        tab = el.dataset.tab;
        render();
      }),
  );
  document.querySelectorAll("[data-action]").forEach(
    (el) =>
      (el.onclick = async () => {
        try {
          await action(el.dataset.action, {
            id: el.dataset.id,
            key: el.dataset.key,
          });
        } catch (e) {
          toast(e.message);
        }
      }),
  );
  submit("#login-form", async (b) => {
    await api("/api/login", b);
    adopt(await api("/api/state"));
    events();
    toast("The studio is yours. Let’s make a story.");
  });
  document.querySelectorAll(".approve-form").forEach(
    (f) =>
      (f.onsubmit = async (e) => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(f));
        try {
          await action("approve", {
            id: f.dataset.id,
            effect: d.key || d.value ? { key: d.key, value: d.value } : null,
          });
        } catch (err) {
          toast(err.message);
        }
      }),
  );
  submit("#scene-form", (b) => action("scene", b));
  submit("#next-form", (b) => action("next", b));
  submit("#fact-form", (b, f) =>
    action("fact", { ...b, locked: f.elements.locked.checked }),
  );
  submit("#terms-form", (b) =>
    action("terms", {
      terms: b.terms
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    }),
  );
  submit("#chat-form", async (b) => {
    const r = await api("/api/simulate", b);
    adopt(r.state);
    toast(
      r.accepted
        ? "Chat command accepted."
        : "Command ignored: check the phase, viewer, filter, or option number.",
    );
  });
  click("#open", () =>
    action("open", { seconds: Number($("#duration").value) }),
  );
  click("#disconnect", async () => {
    await api("/api/twitch/disconnect", {});
    adopt(await api("/api/state"));
  });
  click("#logout", async () => {
    await api("/api/logout", {});
    adopt(await api("/api/state"));
    events();
  });
  click("#reset", async () => {
    if (
      confirm(
        "Reset all rehearsal scenes, canon, facts, and filters? Export your canon first if you want to keep it.",
      )
    )
      adopt(await api("/api/reset", {}));
  });
  click("#sample", async () => {
    for (const [user, text] of [
      [
        "lunar_fox",
        "The knocking is Mara’s future self, warning her not to relight the beacon.",
      ],
      [
        "mosswitch",
        "The lens hatches a tiny storm that recognizes Mara as its keeper.",
      ],
      [
        "inkandembers",
        "Every ship lost at sea is waiting on the other side of the glass.",
      ],
    ]) {
      const r = await api("/api/simulate", { user, text: `!twist ${text}` });
      adopt(r.state);
    }
    toast("Three twists arrived. Approve your favorites.");
  });
  click("#sample-votes", async () => {
    for (let i = 0; i < 12; i++) {
      const n = i < 6 ? 2 : i < 10 ? 1 : Math.min(3, options().length);
      const r = await api("/api/simulate", {
        user: `audience_${i}`,
        text: `!vote ${n}`,
      });
      adopt(r.state);
      await new Promise((r) => setTimeout(r, 90));
    }
    toast("12 rehearsal votes counted.");
  });
}
function updateTimer() {
  if (!state || state.phase !== "voting") return;
  const seconds = Math.max(
    0,
    Math.ceil((state.deadline - Date.now() - offset) / 1000),
  );
  $("#countdown").textContent =
    `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
setInterval(updateTimer, 250);
document.body.classList.toggle("overlay", overlay);
api("/api/state" + (overlay ? "?public=1" : ""))
  .then((s) => {
    adopt(s);
    events();
  })
  .catch((e) => toast(e.message));
