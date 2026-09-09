import { linked, request, connect, walletBalance } from "./wallet-client.mjs";
import { WHEEL, color, settle } from "./roulette-engine.mjs";
import { rand } from "./vault-engine.mjs";
import { GameAudio, bindSound } from "./audio.mjs";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)],
  sfx = new GameAudio("roulette"),
  fmt = (n) => n.toLocaleString("en-US");
let balance = 10000,
  bets = [],
  previous = [],
  chip = 50,
  busy = false,
  lastReturn = 0,
  numbers = [],
  wheelAngle = 0,
  ballAngle = -Math.PI / 2,
  ballRadius = 264;
const canvas = $("#wheel"),
  ctx = canvas.getContext("2d"),
  PI = Math.PI,
  TAU = 2 * PI,
  step = TAU / 37,
  reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
function drawWheel() {
  const x = 380,
    y = 380;
  ctx.clearRect(0, 0, 760, 760);
  const ring = (r, fill, stroke, line = 1) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = line;
      ctx.stroke();
    }
  };
  let metal = ctx.createRadialGradient(380, 220, 80, 380, 380, 374);
  metal.addColorStop(0, "#ecd29b");
  metal.addColorStop(0.55, "#775220");
  metal.addColorStop(0.78, "#241b10");
  metal.addColorStop(0.93, "#bb9851");
  metal.addColorStop(1, "#3b2a15");
  ring(370, metal, "#dec393", 2);
  ring(350, "#19160f", "#685332", 3);
  ring(333, "#463221", "#b1935b", 2);
  ring(318, "#100e0b", "#5b472b", 1);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(wheelAngle);
  WHEEL.forEach((n, i) => {
    const a = -PI / 2 + i * step;
    ctx.beginPath();
    ctx.arc(0, 0, 304, a - step / 2, a + step / 2);
    ctx.arc(0, 0, 231, a + step / 2, a - step / 2, true);
    ctx.closePath();
    ctx.fillStyle = n === 0 ? "#1f8059" : color(n) === "red" ? "#a72d38" : "#142022";
    ctx.fill();
    ctx.strokeStyle = "#d8ba7955";
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.save();
    ctx.rotate(a + PI / 2);
    ctx.fillStyle = "#f7eaca";
    ctx.font = "600 23px Georgia";
    ctx.textAlign = "center";
    ctx.fillText(n, 0, -274);
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(Math.cos(a - step / 2) * 238, Math.sin(a - step / 2) * 238);
    ctx.lineTo(Math.cos(a - step / 2) * 262, Math.sin(a - step / 2) * 262);
    ctx.strokeStyle = "#e3c88c";
    ctx.lineWidth = 2;
    ctx.stroke();
  });
  ctx.restore();
  ring(229, "#342716", "#c0a162", 3);
  const wood = ctx.createRadialGradient(350, 310, 5, 380, 380, 229);
  wood.addColorStop(0, "#715631");
  wood.addColorStop(0.45, "#3c2c18");
  wood.addColorStop(1, "#1f211a");
  ring(221, wood, "#7b653d", 1);
  for (let i = 0; i < 16; i++) {
    const a = (i * TAU) / 16 + wheelAngle;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 142, y + Math.sin(a) * 142);
    ctx.lineTo(x + Math.cos(a) * 215, y + Math.sin(a) * 215);
    ctx.strokeStyle = "#bda46c24";
    ctx.stroke();
  }
  ring(145, "#081b1d", "#b79555", 2);
  ring(135, "#0b2021", "#a6864433", 1);
  ctx.save();
  const bx = x + Math.cos(ballAngle) * ballRadius,
    by = y + Math.sin(ballAngle) * ballRadius;
  ctx.shadowBlur = 9;
  ctx.shadowColor = "#000";
  const pearl = ctx.createRadialGradient(bx - 3, by - 4, 0, bx, by, 9);
  pearl.addColorStop(0, "#fff");
  pearl.addColorStop(0.6, "#f4ecd8");
  pearl.addColorStop(1, "#897e64");
  ctx.beginPath();
  ctx.arc(bx, by, 8, 0, TAU);
  ctx.fillStyle = pearl;
  ctx.fill();
  ctx.restore();
}
function cell(key, label, cls = "") {
  return `<button class="bet-cell ${cls}" data-bet="${key}" aria-label="Bet on ${label}">${label}</button>`;
}
$("#board").innerHTML = cell("n:0", "0", "green zero");
for (let row = 0; row < 3; row++) {
  for (let c = 0; c < 12; c++) {
    const n = (c + 1) * 3 - row;
    $("#board").insertAdjacentHTML("beforeend", cell("n:" + n, n, color(n)));
    const b = $("#board").lastElementChild;
    b.style.gridRow = row + 1;
    b.style.gridColumn = c + 2;
  }
  $("#board").insertAdjacentHTML("beforeend", cell("column:" + (3 - row), "2:1", "column"));
  const b = $("#board").lastElementChild;
  b.style.gridRow = row + 1;
  b.style.gridColumn = 14;
}
// Corner (square) bets: one hot spot at each interior intersection of 4
// numbers, covering {base, base+1, base+3, base+4}. Spans the same 2x2 grid
// area as those 4 number cells so it sits centered on their shared corner -
// see isValidCornerBet in roulette-engine.mjs for the base-number geometry.
for (let c = 0; c < 11; c++) {
  for (let r = 0; r < 2; r++) {
    const base = (c + 1) * 3 - (r + 1);
    $("#board").insertAdjacentHTML("beforeend", cell("corner:" + base, "", "corner"));
    const b = $("#board").lastElementChild;
    b.style.gridRow = `${r + 1} / ${r + 3}`;
    b.style.gridColumn = `${c + 2} / ${c + 4}`;
    b.setAttribute("aria-label", `Corner bet on ${base}, ${base + 1}, ${base + 3}, ${base + 4}`);
  }
}
$("#dozens").innerHTML = [1, 2, 3]
  .map((n) => cell("dozen:" + n, ["1st 12", "2nd 12", "3rd 12"][n - 1]))
  .join("");
$("#outside").innerHTML = [
  ["low", "1–18"],
  ["even", "EVEN"],
  ["red", "RED"],
  ["black", "BLACK"],
  ["odd", "ODD"],
  ["high", "19–36"],
]
  .map(([key, label]) => cell(key, label, key))
  .join("");
$("#chips").innerHTML = [10, 25, 50, 100, 500]
  .map(
    (n) =>
      `<button class="chip ${n === chip ? "active" : ""}" data-chip="${n}" aria-label="${n} credit chip" aria-pressed="${n === chip}">${n}</button>`,
  )
  .join("");
function total() {
  return bets.reduce((a, b) => a + b.amount, 0);
}
function cornerNumbers(key) {
  const base = Number(key.slice(7));
  return `${base}, ${base + 1}, ${base + 3}, ${base + 4}`;
}
function ui() {
  $("#balance").textContent = fmt(balance);
  $("#total-bet").textContent = fmt(total());
  $("#last-win").textContent = fmt(lastReturn);
  $("#spin").disabled = busy || !bets.length;
  $("#spin").textContent = busy ? "SPINNING…" : "SPIN WHEEL";
  $("#undo").disabled = busy || !bets.length;
  $("#clear").disabled = busy || !bets.length;
  $("#rebet").disabled =
    busy || !previous.length || previous.reduce((a, b) => a + b.amount, 0) > balance;
  $("#reset").disabled = busy;
  $$(".bet-cell").forEach((b) => {
    b.disabled = busy;
    const value = bets.filter((x) => x.key === b.dataset.bet).reduce((a, x) => a + x.amount, 0);
    b.classList.toggle("selected", value > 0);
    b.dataset.chips = value;
    const suffix = value ? ", " + value + " credits placed" : "";
    b.setAttribute(
      "aria-label",
      b.dataset.bet.startsWith("corner:")
        ? `Corner bet on ${cornerNumbers(b.dataset.bet)}${suffix}`
        : `Bet ${b.dataset.bet.replace("n:", "number ")}${suffix}`,
    );
  });
  $$(".chip").forEach((b) => {
    b.disabled = busy;
    b.classList.toggle("active", +b.dataset.chip === chip);
    b.setAttribute("aria-pressed", +b.dataset.chip === chip);
  });
}
function status(t) {
  $("#status").textContent = t;
}
$$(".bet-cell").forEach(
  (b) =>
    (b.onclick = () => {
      if (busy) return;
      if (total() + chip > balance) {
        status("Not enough credits for another chip. Choose a smaller chip or clear bets.");
        return;
      }
      bets.push({ key: b.dataset.bet, amount: chip });
      sfx.tone(1100, 0.065, "triangle", 0.05);
      ui();
      status(`${fmt(total())} credits on the table. Ready to spin.`);
    }),
);
$("#chips").onclick = (e) => {
  const b = e.target.closest("[data-chip]");
  if (b && !busy) {
    chip = +b.dataset.chip;
    ui();
    sfx.tone(700, 0.04);
  }
};
$("#undo").onclick = () => {
  if (!busy) {
    bets.pop();
    ui();
  }
};
$("#clear").onclick = () => {
  if (!busy) {
    bets = [];
    ui();
    status("Table cleared. Place your next bet.");
  }
};
$("#rebet").onclick = () => {
  if (!busy && previous.reduce((a, b) => a + b.amount, 0) <= balance) {
    bets = previous.map((b) => ({ ...b }));
    ui();
    status("Your previous bets are back on the table.");
  }
};
async function spin() {
  if (busy || !bets.length || total() > balance) return;
  busy = true;
  ui();
  const roundBets = bets.map((b) => ({ ...b }));
  const remote = linked ? await request("spin", { bets: roundBets }) : null;
  balance -= total();
  previous = roundBets;
  lastReturn = 0;
  ui();
  status("No more bets. The ball is in motion.");
  $$(".bet-cell.result").forEach((b) => b.classList.remove("result"));
  $("#wheel-result").innerHTML =
    "<small>NO MORE BETS</small><strong>●</strong><span>THE WHEEL IS TURNING</span>";
  const stop = sfx.spin("wheel"),
    index = remote ? WHEEL.indexOf(remote.result.number) : rand(37),
    result = WHEEL[index],
    startWheel = wheelAngle,
    startBall = ballAngle,
    endWheel = startWheel + TAU * 2 + rand(628) / 100,
    target = -PI / 2 + index * step + endWheel,
    endBall = target - Math.ceil((target - startBall + TAU * 6) / TAU) * TAU,
    duration = reduced ? 100 : 6200;
  await new Promise((resolve) => {
    const t0 = performance.now();
    function tick(t) {
      const p = Math.min((t - t0) / duration, 1),
        e = 1 - Math.pow(1 - p, 3);
      wheelAngle = startWheel + (endWheel - startWheel) * e;
      ballAngle = startBall + (endBall - startBall) * (1 - Math.pow(1 - p, 2.5));
      ballRadius = p < 0.65 ? 313 : 313 - (313 - 250) * Math.min(1, (p - 0.65) / 0.35);
      drawWheel();
      if (p < 1) requestAnimationFrame(tick);
      else resolve();
    }
    requestAnimationFrame(tick);
  });
  stop();
  wheelAngle = ((wheelAngle % TAU) + TAU) % TAU;
  ballAngle = -PI / 2 + index * step + wheelAngle;
  ballRadius = 250;
  drawWheel();
  const payout = remote ? remote.payout : settle(result, roundBets);
  balance = remote ? remote.balanceAfter : balance + payout;
  lastReturn = payout;
  bets = [];
  busy = false;
  numbers.unshift(result);
  numbers = numbers.slice(0, 10);
  $("#numbers").innerHTML = numbers.map((n) => `<b class="${color(n)}">${n}</b>`).join("");
  $("#wheel-result").innerHTML =
    `<small>${color(result).toUpperCase()}</small><strong>${result}</strong><span>${payout ? "WIN " + fmt(payout) : "PLACE YOUR BETS"}</span>`;
  $(`[data-bet="n:${result}"]`).classList.add("result");
  ui();
  status(
    `${result} ${color(result)}. ${payout ? fmt(payout) + " credits returned." : "No winning bets this round."}`,
  );
  if (payout) sfx.chime(payout >= 500);
  else sfx.tone(190, 0.25);
}
$("#reset").onclick = () => {
  if (busy || linked) return;
  balance = 10000;
  bets = [];
  previous = [];
  lastReturn = 0;
  numbers = [];
  $("#numbers").innerHTML = "<i>Waiting for the first spin</i>";
  $$(".result").forEach((b) => b.classList.remove("result"));
  ui();
  status("Wallet reset to 10,000 virtual credits.");
};
bindSound(sfx, $("#sound"));
$("#help").onclick = () => $("#rules-dialog").showModal();
$("#close-rules").onclick = () => $("#rules-dialog").close();
drawWheel();
ui();

$("#spin").onclick = async () => {
  try {
    await spin();
  } catch (e) {
    busy = false;
    if (linked) balance = walletBalance();
    ui();
    status(e.message || "Round unavailable. Reopen the table.");
  }
};
if (linked) {
  busy = true;
  ui();
  try {
    const init = await connect();
    balance = init.balanceAfter;
    busy = false;
    ui();
    status("Betrix wallet connected.");
  } catch (e) {
    status(e.message);
    busy = true;
    ui();
  }
}
