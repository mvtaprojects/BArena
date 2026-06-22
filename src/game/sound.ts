// Web Audio API based sound engine
class SoundEngine {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicOsc: OscillatorNode[] = [];
  // private musicNodes: AudioNode[] = [];
  private musicPlaying = false;
  private musicEnabled = true;
  private sfxEnabled = true;
  private musicInterval: ReturnType<typeof setInterval> | null = null;

  private getCtx(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.musicGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.18;
        this.sfxGain.gain.value = 0.5;
        this.musicGain.connect(this.ctx.destination);
        this.sfxGain.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    return this.ctx;
  }

  resume() {
    const ctx = this.getCtx();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  }

  setMusic(enabled: boolean) {
    this.musicEnabled = enabled;
    if (this.musicGain) {
      this.musicGain.gain.value = enabled ? 0.18 : 0;
    }
    if (!enabled) this.stopMusic();
  }

  setSfx(enabled: boolean) {
    this.sfxEnabled = enabled;
    if (this.sfxGain) {
      this.sfxGain.gain.value = enabled ? 0.5 : 0;
    }
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = "sine",
    gainVal = 0.4,
    delay = 0
  ) {
    const ctx = this.getCtx();
    if (!ctx || !this.sfxGain) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    gain.gain.setValueAtTime(0, ctx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(gainVal, ctx.currentTime + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.05);
  }

  play(name: string) {
    if (!this.sfxEnabled) return;

    switch (name) {
      case "click":
        this.playTone(440, 0.08, "sine", 0.3);
        this.playTone(660, 0.08, "sine", 0.2, 0.05);
        break;
      case "slide":
        this.playTone(330, 0.12, "sine", 0.25);
        this.playTone(440, 0.12, "sine", 0.2, 0.06);
        break;
      case "buy":
        this.playTone(523, 0.1, "sine", 0.35);
        this.playTone(659, 0.1, "sine", 0.3, 0.1);
        this.playTone(784, 0.2, "sine", 0.4, 0.2);
        break;
      case "code_ok":
        this.playTone(523, 0.12, "sine", 0.4);
        this.playTone(659, 0.12, "sine", 0.35, 0.12);
        this.playTone(784, 0.12, "sine", 0.4, 0.24);
        this.playTone(1046, 0.25, "sine", 0.45, 0.36);
        break;
      case "code_bad":
        this.playTone(200, 0.15, "sawtooth", 0.35);
        this.playTone(150, 0.2, "sawtooth", 0.4, 0.15);
        break;
      case "attack":
        this.playTone(150, 0.05, "sawtooth", 0.5);
        this.playTone(220, 0.08, "square", 0.45, 0.03);
        this.playTone(110, 0.15, "sawtooth", 0.4, 0.08);
        break;
      case "hit":
        this.playTone(100, 0.12, "sawtooth", 0.5);
        this.playTone(80, 0.18, "sawtooth", 0.45, 0.05);
        break;
      case "special":
        this.playTone(200, 0.05, "sawtooth", 0.5);
        this.playTone(300, 0.07, "square", 0.45, 0.05);
        this.playTone(180, 0.05, "sawtooth", 0.5, 0.12);
        this.playTone(150, 0.2, "sawtooth", 0.6, 0.17);
        this.playTone(600, 0.1, "sine", 0.3, 0.1);
        break;
      case "win":
        [523, 659, 784, 1046, 1318].forEach((f, i) => {
          this.playTone(f, 0.18, "sine", 0.45 - i * 0.02, i * 0.12);
        });
        break;
      case "lose":
        [400, 330, 280, 200].forEach((f, i) => {
          this.playTone(f, 0.2, "sawtooth", 0.4, i * 0.15);
        });
        break;
      case "battle_start":
        this.playTone(220, 0.08, "sawtooth", 0.5);
        this.playTone(330, 0.08, "sawtooth", 0.5, 0.1);
        this.playTone(440, 0.15, "sawtooth", 0.55, 0.2);
        this.playTone(880, 0.3, "square", 0.4, 0.35);
        break;
      case "heal":
        this.playTone(523, 0.1, "sine", 0.35);
        this.playTone(659, 0.1, "sine", 0.4, 0.1);
        this.playTone(784, 0.2, "sine", 0.45, 0.2);
        break;
      case "freeze":
        this.playTone(880, 0.05, "square", 0.35);
        this.playTone(1100, 0.05, "square", 0.3, 0.05);
        this.playTone(660, 0.3, "square", 0.25, 0.1);
        break;
      case "levelup":
        [392, 523, 659, 784, 1046].forEach((f, i) => {
          this.playTone(f, 0.15, "sine", 0.4, i * 0.1);
        });
        break;
    }
  }

  startMusic() {
    if (this.musicPlaying || !this.musicEnabled) return;
    this.musicPlaying = true;
    this._playMusicLoop();
  }

  stopMusic() {
    this.musicPlaying = false;
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    this.musicOsc.forEach((o) => {
      try { o.stop(); } catch {}
    });
    this.musicOsc = [];
  }

  private _playMusicLoop() {
    if (!this.musicPlaying || !this.musicEnabled) return;
    const ctx = this.getCtx();
    if (!ctx || !this.musicGain) return;

    // Epic ambient chord progression
    const notes = [
      [110, 138, 165],
      [98, 123, 147],
      [117, 147, 175],
      [104, 131, 156],
    ];

    let step = 0;

    const playChord = () => {
      if (!this.musicPlaying || !this.musicEnabled || !this.musicGain || !ctx) return;

      const chord = notes[step % notes.length];
      step++;

      chord.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i === 0 ? "sawtooth" : "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(
          i === 0 ? 0.06 : 0.04,
          ctx.currentTime + 0.5
        );
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2.5);
        osc.connect(gain);
        gain.connect(this.musicGain!);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 3);
      });
    };

    playChord();
    this.musicInterval = setInterval(playChord, 2200);
  }
}

export const sound = new SoundEngine();
