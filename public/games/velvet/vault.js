import { linked, request, connect, walletBalance } from "./wallet-client.mjs";
import { SlotFX } from "./slot-fx.mjs";
import { GameAudio, bindSound } from "./audio.mjs";
import { SYMBOLS, LINES, draw, makeGrid, evaluate, bonusPrizes } from "./vault-engine.mjs";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const stakes = [10, 20, 50, 100, 200, 500];
let betIndex = 2,
  balance = 1000000,
  lastWin = 0,
  busy = false,
  turbo = false,
  sound = false,
  audio = null,
  current = [
    [0, 3, 8],
    [1, 4, 5],
    [2, 6, 0],
    [4, 7, 1],
    [3, 0, 2],
  ],
  history = [],
  bonus = null,
  showTimer,
  lineTimer,
  overlayFrame;
const fmt = (n) =>
  (n / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const wait = (ms) => new Promise((r) => setTimeout(r, reduced ? Math.min(ms, 50) : ms));
function status(s) {
  $("#status").textContent = s;
}
const sfx = new GameAudio("vault");
const vaultFX = new SlotFX("vault");
function tone(...args) {
  sfx.tone(...args);
}
function chime(big = false) {
  sfx.chime(big);
}
function ui() {
  $("#balance").textContent = fmt(balance);
  $("#last-win").textContent = fmt(lastWin);
  $("#bet").textContent = stakes[betIndex];
  ["spin", "reset", "preview", "speed"].forEach((id) => ($("#" + id).disabled = busy));
  $("#bet-down").disabled = busy || betIndex === 0;
  $("#bet-up").disabled = busy || betIndex === stakes.length - 1;
  $("#spin").classList.toggle("busy", busy);
  $("#spin span").textContent = busy ? "WAIT" : "SPIN";
}
function symbol(s) {
  return `<div class="symbol ${s === 6 || s === 7 ? "special" : ""}" data-label="${s === 6 ? "WILD" : s === 7 ? "BONUS" : ""}" role="img" aria-label="${SYMBOLS[s].name}"><span class="symbol-art art-${s}"></span></div>`;
}
function render(grid) {
  $("#reels").innerHTML = grid
    .map(
      (col) => `<div class="reel"><div class="reel-strip">${col.map(symbol).join("")}</div></div>`,
    )
    .join("");
}
function clearWins() {
  vaultFX.clear();
  clearTimeout(showTimer);
  clearInterval(lineTimer);
  cancelAnimationFrame(overlayFrame);
  $("#win-overlay").classList.remove("show");
  $$(".winning").forEach((el) => el.classList.remove("winning"));
  $$(".expanding").forEach((el) => el.classList.remove("expanding"));
  $("#line-indicator").textContent = "5 REELS / 3 ROWS";
}
function showWins(result) {
  if (!result.wins.length) return;
  let i = 0;
  const highlight = () => {
    $$(".winning").forEach((el) => el.classList.remove("winning"));
    const w = result.wins[i % result.wins.length];
    w.rows.slice(0, w.count).forEach((row, col) => {
      $$(".reel")[col].querySelectorAll(".symbol")[row].classList.add("winning");
    });
    $("#line-indicator").textContent = `LINE ${w.line + 1} · +${fmt(w.cents)}`;
    i++;
  };
  highlight();
  const cells = $$(".winning");
  for (const el of cells) {
    vaultFX.burst(vaultFX.point(el), 12);
    vaultFX.ring(vaultFX.point(el));
  }
  lineTimer = setInterval(highlight, 1600);
}
function celebrate(cents, stake) {
  if (cents < stake * 100) return;
  $("#win-heading").textContent =
    cents >= stake * 1000
      ? "HEIST OF THE NIGHT"
      : cents >= stake * 500
        ? "VAULT HIT"
        : "LOOT SECURED";
  $("#win-overlay").classList.add("show");
  let t0 = performance.now();
  const tick = (t) => {
    const progress = Math.min(1, (t - t0) / (reduced ? 1 : 850));
    $("#win-amount").textContent = fmt(Math.round(cents * (1 - Math.pow(1 - progress, 3))));
    if (progress < 1) overlayFrame = requestAnimationFrame(tick);
  };
  overlayFrame = requestAnimationFrame(tick);
  burst(60);
  showTimer = setTimeout(() => $("#win-overlay").classList.remove("show"), 2300);
}
async function animateReels(final) {
  const reels = $$(".reel");
  await Promise.all(
    reels.map(async (reel, c) => {
      const stream = [...current[c], ...Array.from({ length: 14 }, draw), ...final[c]];
      const strip = reel.firstElementChild;
      strip.innerHTML = stream.map(symbol).join("");
      reel.classList.add("rolling");
      const height = reel.clientHeight / 3;
      const anim = strip.animate(
        [{ transform: "translateY(0)" }, { transform: `translateY(-${17 * height}px)` }],
        {
          duration: reduced ? 1 : turbo ? 560 + c * 100 : 1700 + c * 260,
          easing: "cubic-bezier(.16,.65,.12,1)",
          fill: "forwards",
        },
      );
      try {
        await anim.finished;
      } finally {
        strip.innerHTML = final[c].map(symbol).join("");
        anim.cancel();
        reel.classList.remove("rolling");
      }
      tone(130 + c * 35, 0.13, "triangle", 0.07);
      if (final[c].includes(7)) tone(650 + c * 90, 0.24, "sine", 0.06);
    }),
  );
}
async function executeSpin() {
  if (busy || $("dialog[open]")) return;
  const stake = stakes[betIndex];
  if (balance < stake * 100) {
    status("Not enough credits. Lower your bet or reset the demo balance.");
    return;
  }
  busy = true;
  clearWins();
  balance -= stake * 100;
  lastWin = 0;
  ui();
  status("Slipping past security…");
  $("#locks").textContent = "◇ ◇ ◇";
  tone(75, 0.45, "sawtooth", 0.025);
  const remote = linked ? await request("spin", { stake }) : null;
  const grid = remote ? remote.result.grid : makeGrid();
  const result = remote ? remote.result.evaluation : evaluate(grid, stake);
  const stopSpin = sfx.spin();
  try {
    await animateReels(grid);
  } finally {
    stopSpin();
  }
  current = grid;
  $("#locks").textContent = Array.from({ length: 3 }, (_, i) =>
    i < result.locks ? "◆" : "◇",
  ).join(" ");
  if (result.expanded.length) {
    status("Master key found. Opening the entire reel…");
    tone(220, 0.65, "triangle", 0.08);
    await wait(250);
    current = result.grid;
    render(current);
    result.expanded.forEach((c) => $$(".reel")[c].classList.add("expanding"));
    await wait(turbo ? 300 : 850);
  }
  balance = linked ? Math.round(walletBalance() * 100) : balance + result.cents;
  lastWin = result.cents;
  ui();
  showWins(result);
  if (result.cents) {
    chime(result.cents >= stake * 500);
    status(
      `${result.wins.length} winning ${result.wins.length === 1 ? "line" : "lines"} · ${fmt(result.cents)} credits secured.`,
    );
  } else
    status(
      [
        "The vault holds its secrets. Try again.",
        "No loot this round. The next move is yours.",
        "Security passed. No matching payline.",
      ][Math.floor(Math.random() * 3)],
    );
  if (result.bonus) {
    status("Three locks. Security overridden. You’re inside.");
    chime(true);
    await wait(800);
    openBonus(false, stake, result.cents);
  } else {
    finishRound(stake, lastWin);
    celebrate(lastWin, stake);
  }
}
function finishRound(stake, win) {
  history.unshift({ win, stake });
  history = history.slice(0, 5);
  $("#recent").innerHTML = history
    .map(
      (h) =>
        `<b class="${h.win ? "" : "loss"}" title="Bet ${h.stake} · Returned ${fmt(h.win)}">${h.win ? "+" + fmt(h.win) : "—"}</b>`,
    )
    .join("");
  busy = false;
  ui();
}
function openBonus(preview, stake = stakes[betIndex], lineWin = 0) {
  clearTimeout(showTimer);
  $("#win-overlay").classList.remove("show");
  busy = true;
  ui();
  bonus = { preview, stake, lineWin, prizes: bonusPrizes(), picks: new Set(), cents: 0 };
  $("#bonus-mode").textContent = preview ? "FREE PREVIEW" : "BONUS ROUND";
  $("#bonus-instruction").textContent = "Choose 3 safes. Your loot is waiting.";
  $("#bonus-total").textContent = "0.00";
  $("#collect").disabled = true;
  $("#collect").textContent = "Pick 3 safes";
  $("#safes").innerHTML = bonus.prizes
    .map(
      (_, i) =>
        `<button class="safe" data-safe="${i}" aria-label="Open safe ${i + 1}"><span class="mini-symbol art-7"></span><small>SAFE 0${i + 1}</small></button>`,
    )
    .join("");
  $("#bonus-dialog").showModal();
  tone(110, 0.7, "triangle", 0.08);
}
$("#safes").onclick = async (e) => {
  const b = e.target.closest("[data-safe]");
  if (!b || !bonus || bonus.picks.size >= 3) return;
  const i = Number(b.dataset.safe);
  if (bonus.picks.has(i)) return;
  if (bonus.pending) return;
  bonus.pending = true;
  let prize;
  try {
    if (linked && !bonus.preview) {
      const r = await request("pick", { index: i });
      prize = r.result.prize;
      balance = Math.round(r.balanceAfter * 100);
    } else prize = bonus.prizes[i];
  } catch (e) {
    status(e.message);
    return;
  } finally {
    bonus.pending = false;
  }
  bonus.picks.add(i);
  const cents = prize * bonus.stake * 100;
  bonus.cents += cents;
  b.disabled = true;
  b.classList.add("open");
  b.insertAdjacentHTML(
    "beforeend",
    `<strong>${prize}×</strong><span class="credits">${fmt(cents)} cr</span>`,
  );
  b.setAttribute("aria-label", `Safe ${i + 1}: ${prize} times bet, ${fmt(cents)} credits`);
  $("#bonus-total").textContent = fmt(bonus.cents);
  chime(prize >= 12);
  burst(20);
  const left = 3 - bonus.picks.size;
  $("#bonus-instruction").textContent = left
    ? `${left} ${left === 1 ? "safe" : "safes"} left to choose.`
    : bonus.preview
      ? "Preview complete. Your balance stays unchanged."
      : "The loot is yours. Collect and make your exit.";
  $("#collect").textContent = left
    ? `Pick ${left} more`
    : bonus.preview
      ? "Finish preview"
      : "Collect loot";
  $("#collect").disabled = left > 0;
  if (!left) $$(".safe").forEach((b) => (b.disabled = true));
};
$("#collect").onclick = () => {
  if (!bonus || bonus.picks.size < 3) return;
  const b = bonus;
  bonus = null;
  $("#bonus-dialog").close();
  if (b.preview) {
    busy = false;
    status("Bonus preview complete. Ready for your next spin.");
    ui();
  } else {
    balance = linked ? Math.round(walletBalance() * 100) : balance + b.cents;
    lastWin = b.lineWin + b.cents;
    finishRound(b.stake, lastWin);
    status(`Heist complete. ${fmt(lastWin)} total credits secured.`);
    celebrate(lastWin, b.stake);
  }
};
$("#bonus-dialog").addEventListener("cancel", (e) => {
  e.preventDefault();
  if (bonus?.preview) {
    bonus = null;
    $("#bonus-dialog").close();
    busy = false;
    ui();
    status("Bonus preview closed. Ready when you are.");
  }
});
$("#spin").onclick = spin;
$("#preview").onclick = () => {
  if (!busy) openBonus(true);
};
$("#bet-down").onclick = () => {
  if (!busy && betIndex > 0) {
    betIndex--;
    ui();
    tone(260, 0.05);
  }
};
$("#bet-up").onclick = () => {
  if (!busy && betIndex < stakes.length - 1) {
    betIndex++;
    ui();
    tone(340, 0.05);
  }
};
$("#speed").onclick = () => {
  if (busy) return;
  turbo = !turbo;
  $("#speed").setAttribute("aria-pressed", turbo);
  $("#speed span").textContent = turbo ? "ON" : "OFF";
};
$("#reset").onclick = () => {
  if (busy || linked) return;
  balance = 1000000;
  lastWin = 0;
  history = [];
  $("#recent").innerHTML = "<i>Your story starts here.</i>";
  clearWins();
  ui();
  status("Fresh start. 10,000 virtual credits in your wallet.");
};
bindSound(sfx, $("#sound"));
$("#fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen)
      await document.documentElement.requestFullscreen();
    else status("Full screen is not supported in this browser.");
  } catch {
    status("Full screen is unavailable in this browser.");
  }
};
$("#help").onclick = () => $("#rules-dialog").showModal();
$$("[data-close]").forEach((b) => (b.onclick = () => $("#" + b.dataset.close).close()));
$("#paytable").innerHTML =
  `<table class="paytable"><thead><tr><th>SYMBOL</th><th>3</th><th>4</th><th>5</th></tr></thead><tbody>${SYMBOLS.map((s, i) => (i === 7 ? "" : `<tr><td><span class="mini-symbol art-${i}"></span>${s.name}</td>${s.pay.map((p) => `<td>${p}×</td>`).join("")}</tr>`)).join("")}</tbody><caption>Multipliers apply to the line bet (total bet ÷ 10).</caption></table><h3>The 10 paylines</h3><div class="paylines">${LINES.map((line, i) => `<div class="payline"><b>${i + 1}</b><span>${Array.from({ length: 15 }, (_, n) => `<i class="${line[n % 5] === Math.floor(n / 5) ? "on" : ""}"></i>`).join("")}</span></div>`).join("")}</div>`;
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
const canvas = $("#particles"),
  ctx = canvas.getContext("2d");
let motes = [],
  w = 0,
  h = 0;
function size() {
  w = innerWidth;
  h = innerHeight;
  canvas.width = w;
  canvas.height = h;
}
window.addEventListener("resize", size);
size();
function burst(n) {
  if (reduced) return;
  for (let i = 0; i < n; i++)
    motes.push({
      x: w * 0.44,
      y: h * 0.5,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 8 - 1,
      life: 1,
      size: Math.random() * 3 + 1,
    });
}
function particles() {
  ctx.clearRect(0, 0, w, h);
  motes = motes.filter((p) => p.life > 0);
  for (const p of motes) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.07;
    p.life -= 0.011;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = "#f1ce83";
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  requestAnimationFrame(particles);
}
if (!reduced) particles();
render(current);
ui();

async function spin() {
  try {
    await executeSpin();
  } catch (e) {
    busy = false;
    balance = linked ? Math.round(walletBalance() * 100) : balance;
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
    busy = false;
    ui();
    status("Betrix wallet connected.");
    if (init.state?.kind === "vault") {
      const st = init.state;
      openBonus(false, st.stake, st.lineWin);
      bonus.cents = st.total;
      for (const pick of st.picks) {
        bonus.picks.add(pick.index);
        const b = $(`[data-safe="${pick.index}"]`);
        b.disabled = true;
        b.classList.add("open");
        b.insertAdjacentHTML("beforeend", `<strong>${pick.prize}×</strong>`);
      }
      $("#bonus-total").textContent = fmt(st.total);
      const left = 3 - st.picks.length;
      $("#bonus-instruction").textContent = `Bonus restored. Choose ${left} more safes.`;
      $("#collect").textContent = `Pick ${left} more`;
    }
  } catch (e) {
    status(e.message);
    busy = true;
    ui();
  }
}
