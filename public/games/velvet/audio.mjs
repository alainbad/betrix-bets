export class GameAudio {
  constructor(theme = "vault") {
    this.theme = theme;
    this.ctx = null;
    this.active = new Set();
    try {
      this.enabled = sessionStorage.getItem("velvet-sound") !== "off";
    } catch {
      this.enabled = true;
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.stopAll();
    });
    window.addEventListener("pagehide", () => this.stopAll());
  }
  unlock() {
    if (!this.enabled) return false;
    try {
      this.ctx ??= new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === "suspended") this.ctx.resume();
      return true;
    } catch {
      return false;
    }
  }
  setEnabled(v) {
    this.enabled = v;
    try {
      sessionStorage.setItem("velvet-sound", v ? "on" : "off");
    } catch {}
    if (v) this.unlock();
    else {
      this.stopAll();
      this.ctx?.suspend();
    }
  }
  tone(freq = 330, duration = 0.15, type = "sine", volume = 0.05, delay = 0) {
    if (!this.unlock()) return;
    const o = this.ctx.createOscillator(),
      g = this.ctx.createGain(),
      t = this.ctx.currentTime + delay;
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start(t);
    o.stop(t + duration + 0.03);
  }
  chime(big = false) {
    const scale =
      this.theme === "candy"
        ? [523, 659, 784, 1047]
        : this.theme === "thunder"
          ? [196, 294, 392, 587]
          : [392, 494, 587, 784];
    [...scale, ...(big ? [scale[2] * 2, scale[3] * 2] : [])].forEach((f, i) =>
      this.tone(f, 0.4, "sine", 0.045, i * 0.095),
    );
    this.tone(scale[0] / 4, 0.6, "triangle", 0.05);
  }
  land(column = 0, special = false) {
    this.tone((this.theme === "candy" ? 350 : 105) + column * 28, 0.075, "triangle", 0.022);
    if (special) this.tone(1100, 0.18, "sine", 0.035);
  }
  match(count = 8) {
    if (this.theme !== "thunder") {
      [660, 880, 1050].forEach((f, i) => this.tone(f, 0.12, "sine", 0.035, i * 0.045));
      return;
    }
    if (!this.unlock()) return;
    const c = this.ctx,
      src = c.createBufferSource(),
      buffer = c.createBuffer(1, Math.floor(c.sampleRate * 0.65), c.sampleRate),
      data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1600, c.currentTime);
    filter.frequency.exponentialRampToValueAtTime(110, c.currentTime + 0.6);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.001, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.09, c.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.63);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start();
    src.stop(c.currentTime + 0.65);
    this.tone(56, 0.5, "triangle", 0.06);
  }
  stopAll() {
    for (const stop of [...this.active]) stop();
  }
  spin(kind = "reels") {
    if (!this.unlock()) return () => {};
    const c = this.ctx,
      now = c.currentTime,
      g = c.createGain(),
      filter = c.createBiquadFilter(),
      source = c.createBufferSource(),
      motor = c.createOscillator(),
      mg = c.createGain();
    const buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate),
      data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
    source.buffer = buffer;
    source.loop = true;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(kind === "wheel" ? 2200 : 550, now);
    filter.Q.value = 0.8;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(kind === "wheel" ? 0.11 : 0.055, now + 0.13);
    source.connect(filter);
    filter.connect(g);
    g.connect(c.destination);
    motor.type = "triangle";
    motor.frequency.setValueAtTime(kind === "wheel" ? 80 : this.theme === "candy" ? 220 : 65, now);
    motor.frequency.exponentialRampToValueAtTime(kind === "wheel" ? 45 : 110, now + 2.2);
    mg.gain.value = 0.022;
    motor.connect(mg);
    mg.connect(g);
    source.start();
    motor.start();
    let ticks = 0;
    const timer = setInterval(
      () => {
        if (this.enabled) {
          this.tone(
            kind === "wheel" ? 1600 - (ticks % 7) * 90 : 180 + (ticks % 5) * 60,
            0.025,
            "triangle",
            kind === "wheel" ? 0.025 : 0.035,
          );
          ticks++;
        }
      },
      kind === "wheel" ? 95 : 75,
    );
    let done = false;
    const stop = () => {
      if (done) return;
      done = true;
      clearInterval(timer);
      const t = c.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setTargetAtTime(0.0001, t, 0.05);
      source.stop(t + 0.2);
      motor.stop(t + 0.2);
      this.active.delete(stop);
    };
    this.active.add(stop);
    return stop;
  }
  pop(index = 0) {
    this.tone((this.theme === "thunder" ? 200 : 600) + index * 60, 0.12, "sine", 0.045);
  }
}
export function bindSound(audio, button) {
  const paint = () => {
    button.classList.toggle("enabled", audio.enabled);
    button.setAttribute("aria-pressed", audio.enabled);
    button.setAttribute("aria-label", audio.enabled ? "Mute sound" : "Enable sound");
    button.title = audio.enabled ? "Sound on — mute" : "Sound off — enable";
    button.innerHTML = audio.enabled
      ? '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4zM16 9l5 6m0-6-5 6"/></svg>';
  };
  button.onclick = () => {
    audio.setEnabled(!audio.enabled);
    paint();
    if (audio.enabled) audio.chime();
  };
  paint();
}
