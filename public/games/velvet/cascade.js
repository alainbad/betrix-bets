import { linked, request, connect, walletBalance } from "./wallet-client.mjs";
import { SlotFX, dropMotion } from "./slot-fx.mjs";
import {
  CONFIG,
  PAY,
  drawCell,
  makeBoard,
  evaluateBoard,
  collapse,
  roundMultiplier,
  scatterCount,
} from "./cascade-engine.mjs";
import { GameAudio, bindSound } from "./audio.mjs";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)],
  theme = document.body.dataset.theme,
  cfg = CONFIG[theme],
  sfx = new GameAudio(theme),
  reduced = matchMedia("(prefers-reduced-motion: reduce)").matches,
  stakes = [10, 20, 50, 100, 200, 500],
  fmt = (n) =>
    (n / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let balance = 1000000,
  lastWin = 0,
  betIndex = 2,
  busy = false,
  turbo = false,
  feature = null,
  grid = makeBoard(theme),
  overlayTimer,
  dialogAction = () => {},
  dialogKind = "";
const wait = (ms) =>
  new Promise((r) => setTimeout(r, reduced ? Math.min(ms, 30) : turbo ? ms * 0.4 : ms));
const fx = new SlotFX(theme);
function status(t) {
  $("#status").textContent = t;
}
function ui() {
  $("#balance").textContent = fmt(balance);
  $("#last-win").textContent = fmt(lastWin);
  $("#bet").textContent = feature ? feature.stake : stakes[betIndex];
  $("#bet-down").disabled = busy || !!feature || betIndex === 0;
  $("#bet-up").disabled = busy || !!feature || betIndex === stakes.length - 1;
  $("#spin").disabled = busy || (!!feature && feature.remaining === 0);
  $("#spin span").textContent = busy ? "WAIT" : feature ? "FREE SPIN" : "SPIN";
  $("#spin").classList.toggle("busy", busy);
  $("#preview").disabled = busy || !!feature;
  $("#reset").disabled = busy || !!feature;
  $("#turbo").disabled = busy;
  $("#feature-banner").hidden = !feature;
  if (feature) {
    $("#feature-mode").textContent = feature.preview ? "PREVIEW SPINS" : "FREE SPINS";
    $("#remaining").textContent = feature.remaining;
    $("#feature-bank").textContent = "FEATURE WIN " + fmt(feature.total);
    $("#end-preview").hidden = !feature.preview;
    $("#end-preview").disabled = busy;
  } else $("#end-preview").hidden = true;
}
function cell(item, c, r, drop = 0) {
  const special = item.s === 6 || item.s === 7;
  return `<div class="cascade-cell" data-pos="${c}:${r}" role="img" aria-label="${cfg.symbols[item.s]}${item.m ? " " + item.m + " times multiplier" : ""}" style="--drop:${drop};--delay:${drop ? c * 0.035 : 0}s"><span class="cascade-art art-${item.s}"></span>${item.s === 6 ? '<span class="tag">SCATTER</span>' : ""}${item.s === 7 ? `<strong class="factor">${item.m}×</strong>` : ""}</div>`;
}
function render(falls = null) {
  $("#grid").innerHTML = grid
    .map(
      (col, c) =>
        `<div class="cascade-column">${col.map((item, r) => cell(item, c, r, falls?.[c]?.[r] || 0)).join("")}</div>`,
    )
    .join("");
}
async function animate(el, frames, options, persist = false) {
  const a = el.animate(frames, { fill: "both", ...options });
  try {
    await a.finished;
  } catch {
  } finally {
    if (persist) {
      const end = frames.at(-1);
      for (const key of ["transform", "opacity", "filter"])
        if (end[key] !== undefined) el.style[key] = String(end[key]);
    }
    a.cancel();
  }
}
async function leaveBoard() {
  if (reduced) return;
  const els = $$(".cascade-cell");
  await Promise.all(
    els.map((el, i) =>
      animate(
        el,
        [
          { transform: "translateY(0)", opacity: 1 },
          { transform: "translateY(210px) scale(.92,1.1)", opacity: 0 },
        ],
        {
          duration: turbo ? 110 : 210,
          delay: (Math.floor(i / 5) * 20 + (i % 5) * 6) * (turbo ? 0.4 : 1),
          easing: "cubic-bezier(.5,0,.9,.4)",
        },
        true,
      ),
    ),
  );
}
async function dropBoard(falls) {
  render(falls);
  if (reduced) return;
  const rows = $$(".cascade-cell");
  await Promise.all(
    rows.map(async (el) => {
      const [c, r] = el.dataset.pos.split(":").map(Number),
        distance = falls?.[c]?.[r] || 0;
      if (!distance) return;
      const motion = dropMotion(distance, el.getBoundingClientRect().height, theme, turbo, c, r);
      await animate(el, motion.frames, { duration: motion.duration, delay: motion.delay });
      const special = grid[c][r].s === 6 || grid[c][r].s === 7;
      if (r === 4 || special) {
        fx.land(el, special);
        sfx.land?.(c, special);
      }
    }),
  );
}
async function hitBoard(result) {
  const elements = [...result.remove].map((pos) => $(`[data-pos="${pos}"]`));
  elements.forEach((el) => el.classList.add("match"));
  sfx.pop();
  await wait(360);
  fx.match(elements, $(".cascade-frame"));
  for (const win of result.wins) {
    const group = elements.filter((el) => {
      const [c, r] = el.dataset.pos.split(":").map(Number);
      return grid[c][r].s === win.s;
    });
    fx.label(group, "+" + fmt(win.cents));
  }
  sfx.match?.(elements.length);
  await wait(230);
  const flights = [];
  for (const el of elements) {
    const [c, r] = el.dataset.pos.split(":").map(Number);
    if (grid[c][r].s === 7) flights.push(fx.absorb(el, $("#multiplier"), grid[c][r].m, turbo));
  }
  if (!reduced)
    await Promise.all(
      elements.map((el, i) =>
        animate(
          el,
          theme === "candy"
            ? [
                { transform: "scale(1)", opacity: 1 },
                {
                  transform: "scale(1.2) rotate(-7deg)",
                  filter: "brightness(1.35)",
                  opacity: 1,
                  offset: 0.3,
                },
                { transform: "scale(.05) rotate(15deg)", opacity: 0 },
              ]
            : [
                { transform: "scale(1)", opacity: 1 },
                { transform: "scale(1.07)", filter: "brightness(2)", opacity: 1, offset: 0.2 },
                { transform: "scale(.45)", filter: "brightness(1.5)", opacity: 0 },
              ],
          {
            duration: turbo ? 150 : 320,
            delay: (i % 5) * 12 * (turbo ? 0.4 : 1),
            easing: "ease-in",
          },
          true,
        ),
      ),
    );
  elements.forEach((el) => (el.style.opacity = "0"));
  await Promise.all(flights);
}
function multUI(mult) {
  $("#multiplier").textContent = mult + "×";
  if (feature && theme === "thunder") $("#mult-caption").textContent = "ACCUMULATED STORM CHARGE";
  else $("#mult-caption").textContent = "TUMBLE MULTIPLIER";
}
function clearOverlay() {
  fx.clear();
  clearTimeout(overlayTimer);
  $("#big-win").classList.remove("show");
}
function celebrate(cents, stake) {
  if (cents < stake * 100) return;
  $("#win-title").textContent =
    cents >= stake * 1000
      ? theme === "candy"
        ? "SUGAR SENSATION"
        : "STORM OF FORTUNE"
      : theme === "candy"
        ? "SWEET WIN"
        : "DIVINE WIN";
  $("#win-value").textContent = fmt(cents);
  $("#big-win").classList.add("show");
  overlayTimer = setTimeout(() => $("#big-win").classList.remove("show"), 2100);
  sfx.chime(cents >= stake * 500);
  fx.celebrate($(".cascade-frame"));
}
function flash() {
  if (theme !== "thunder" || reduced) return;
  $("#flash").classList.remove("storm-flash");
  void $("#flash").offsetWidth;
  $("#flash").classList.add("storm-flash");
}
function featureDialog(kind, title, value, desc, action, label) {
  dialogKind = kind;
  $("#feature-dialog-label").textContent =
    kind === "preview"
      ? "FREE FEATURE PREVIEW"
      : kind === "summary"
        ? "FEATURE COMPLETE"
        : "FEATURE UNLOCKED";
  $("#feature-dialog-title").textContent = title;
  $("#feature-dialog-value").textContent = value;
  $("#feature-dialog-text").textContent = desc;
  $("#feature-dialog-action").textContent = label;
  dialogAction = action;
  $("#feature-dialog").showModal();
}
function startFeature(preview, stake = stakes[betIndex]) {
  clearOverlay();
  feature = { preview, stake, remaining: cfg.free, total: 0, charge: 0, savedLast: lastWin };
  multUI(1);
  ui();
  featureDialog(
    preview ? "preview" : "earned",
    cfg.feature,
    cfg.free + " FREE SPINS",
    preview
      ? "Play the full feature without changing your virtual wallet."
      : theme === "thunder"
        ? "Every collected lightning multiplier adds to your storm charge."
        : "Collect sugar potions to multiply your tumble wins.",
    () => {
      status(`${cfg.free} ${preview ? "preview" : "free"} spins ready. Tap Free Spin to begin.`);
      ui();
    },
    "Start free spins",
  );
  sfx.chime(true);
}
function finishFeature() {
  const f = feature;
  feature = null;
  if (f.preview) lastWin = f.savedLast;
  multUI(1);
  ui();
  featureDialog(
    "summary",
    f.preview ? "Preview complete" : cfg.feature + " complete",
    fmt(f.total) + " CREDITS",
    f.preview
      ? "Preview winnings only. Your wallet has not changed."
      : "Your feature winnings have been added to your virtual wallet.",
    () => {
      status("Ready for your next spin.");
      ui();
    },
    "Back to game",
  );
}
$("#feature-dialog-action").onclick = () => {
  $("#feature-dialog").close();
  const fn = dialogAction;
  dialogAction = () => {};
  fn();
};
$("#feature-dialog").addEventListener("cancel", (e) => {
  if (dialogKind === "earned") {
    e.preventDefault();
    return;
  }
  if (dialogKind === "preview") {
    if (feature?.preview) {
      lastWin = feature.savedLast;
      feature = null;
      multUI(1);
      ui();
      status("Feature preview closed.");
    }
  }
});
async function executeSpin() {
  if (busy || $("dialog[open]") || (feature && feature.remaining === 0)) return;
  const inFeature = !!feature,
    stake = feature ? feature.stake : stakes[betIndex];
  if (!inFeature && balance < stake * 100) {
    status("Not enough credits. Lower your bet or reset the demo wallet.");
    return;
  }
  busy = true;
  ui();
  const remote = linked && !feature?.preview ? await request("spin", { stake }) : null;
  clearOverlay();
  lastWin = 0;
  if (feature) feature.remaining--;
  else balance -= stake * 100;
  ui();
  multUI(theme === "thunder" && feature ? Math.max(1, feature.charge) : 1);
  $("#tumble-count").textContent = "LET IT FALL";
  $("#round-detail").textContent = inFeature ? "Free spin in play…" : "Spin in play…";
  status(theme === "candy" ? "A fresh shower of sweets…" : "The storm is gathering…");
  const stop = sfx.spin();
  await leaveBoard();
  grid = remote ? remote.result.initial : makeBoard(theme);
  const initialScatters = remote ? remote.result.initialScatters : scatterCount(grid);
  try {
    await dropBoard(Array.from({ length: 6 }, () => [6, 6, 6, 6, 6]));
  } finally {
    stop();
  }
  let base = 0,
    collected = 0,
    tumbles = 0,
    details = [];
  for (let t = 0; t < 20; t++) {
    const raw = remote ? remote.result.steps[t]?.evaluation : null;
    const result = remote
      ? raw
        ? { ...raw, remove: new Set(raw.remove) }
        : { wins: [] }
      : evaluateBoard(grid, stake);
    if (!result.wins.length) break;
    tumbles++;
    base += result.cents;
    collected += result.multiplier;
    const multiplier = roundMultiplier(theme, inFeature, feature?.charge || 0, collected);
    $("#tumble-count").textContent = "TUMBLE " + tumbles;
    status(
      `${fmt(result.cents)} credits from ${result.wins.map((w) => w.count + " " + cfg.symbols[w.s]).join(" + ")}.`,
    );
    details.push(...result.wins.map((w) => `${w.count} ${cfg.symbols[w.s]} +${fmt(w.cents)}`));
    await hitBoard(result);
    multUI(multiplier);
    if (result.multiplier) {
      sfx.chime();
      $("#multiplier").animate?.(
        [
          { transform: "scale(1)" },
          { transform: "scale(1.3)", offset: 0.35 },
          { transform: "scale(1)" },
        ],
        { duration: reduced ? 1 : 400 },
      );
    }
    if (t === 19) break;
    const next = remote
      ? remote.result.steps[t].next
      : collapse(grid, result.remove, () => drawCell(theme));
    grid = next.grid;
    await dropBoard(next.falls);
  }
  const multiplier = roundMultiplier(theme, inFeature, feature?.charge || 0, collected),
    payout = base * multiplier;
  if (feature) {
    feature.total += payout;
    if (theme === "thunder") feature.charge += collected;
    if (!feature.preview) balance += payout;
  } else balance += payout;
  if (remote) balance = Math.round(remote.balanceAfter * 100);
  lastWin = payout;
  multUI(multiplier);
  $("#round-detail").textContent = base
    ? `${fmt(base)} tumble credits × ${multiplier} = ${fmt(payout)}${feature?.preview ? " preview credits" : ""}`
    : "No matching groups this spin.";
  $("#tumble-count").textContent = tumbles
    ? `${tumbles} ${tumbles === 1 ? "TUMBLE" : "TUMBLES"}`
    : "6 × 5";
  status(
    payout
      ? `${fmt(payout)} ${feature?.preview ? "preview " : ""}credits ${theme === "candy" ? "collected" : "claimed"}.`
      : "No winning group this time. Try another spin.",
  );
  busy = false;
  ui();
  if (!inFeature && initialScatters >= 4) {
    $$(".cascade-cell").forEach((el) => {
      if (el.getAttribute("aria-label") === cfg.symbols[6]) el.classList.add("match");
    });
    startFeature(false, stake);
  } else if (feature && feature.remaining === 0) {
    finishFeature();
  } else celebrate(payout, stake);
}
$("#spin").onclick = spin;
$("#preview").onclick = () => {
  if (!busy && !feature) startFeature(true);
};
$("#end-preview").onclick = () => {
  if (!busy && feature?.preview) finishFeature();
};
$("#bet-down").onclick = () => {
  if (!busy && !feature && betIndex > 0) {
    betIndex--;
    ui();
    sfx.tone(280, 0.05);
  }
};
$("#bet-up").onclick = () => {
  if (!busy && !feature && betIndex < stakes.length - 1) {
    betIndex++;
    ui();
    sfx.tone(380, 0.05);
  }
};
$("#turbo").onclick = () => {
  if (busy) return;
  turbo = !turbo;
  $("#turbo").setAttribute("aria-pressed", turbo);
  $("#turbo b").textContent = turbo ? "ON" : "OFF";
};
$("#reset").onclick = () => {
  if (busy || feature || linked) return;
  balance = 1000000;
  lastWin = 0;
  clearOverlay();
  multUI(1);
  ui();
  status("Demo wallet reset to 10,000 virtual credits.");
  $("#round-detail").textContent = "A fresh start. Make your next spin.";
};
bindSound(sfx, $("#sound"));
$("#help").onclick = () => $("#rules-dialog").showModal();
$("#close-rules").onclick = () => $("#rules-dialog").close();
$("#paytable").innerHTML =
  `<table class="paytable"><thead><tr><th>SYMBOL</th><th>8–9</th><th>10–11</th><th>12+</th></tr></thead><tbody>${cfg.symbols.map((name, i) => (i === 6 || i === 7 ? "" : `<tr><td><span class="cascade-art art-${i}"></span>${name}</td>${PAY[i].map((n) => `<td>${n}×</td>`).join("")}</tr>`)).join("")}</tbody><caption>Multipliers apply to your total bet. All qualifying symbol groups pay.</caption></table>`;
$("#mult-rules").textContent =
  `${theme === "candy" ? "Sugar potions" : "Lightning orbs"} on a winning board are collected once and removed with the winners. Their values (${cfg.multipliers.map((n) => n + "×").join(", ")}) add together. At the end of the spin, all tumble winnings are multiplied by their sum, or 1 if none were collected. ${theme === "thunder" ? "During free spins, collected values also carry into following free spins as storm charge." : "The multiplier resets on every spin, including free spins."} A multiplier without a winning group pays nothing. The three lower values share 70% probability; the three higher values share 30%.`;
document.addEventListener("keydown", (e) => {
  if (
    e.code === "Space" &&
    !e.repeat &&
    !$("dialog[open]") &&
    !/BUTTON|INPUT|SELECT|TEXTAREA|A/.test(e.target.tagName)
  ) {
    e.preventDefault();
    spin();
  }
});
render();
ui();

async function spin() {
  try {
    await executeSpin();
  } catch (e) {
    busy = false;
    if (linked) balance = Math.round(walletBalance() * 100);
    ui();
    status(e.message || "Spin unavailable. Reopen the game to resume.");
  }
}
if (linked) {
  busy = true;
  ui();
  try {
    const init = await connect();
    balance = Math.round(init.balanceAfter * 100);
    if (init.state?.kind === "cascade") feature = { ...init.state, preview: false, savedLast: 0 };
    busy = false;
    ui();
    status(feature ? "Your free spins have been restored." : "Betrix wallet connected.");
  } catch (e) {
    status(e.message);
    busy = true;
    ui();
  }
}
