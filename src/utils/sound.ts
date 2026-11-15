// Synthesized Web Audio API sound effects (zero external asset failures)
class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.14, delay = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  playClick() {
    this.playTone(540, 0.06, 'triangle', 0.1);
  }

  playJoin() {
    this.playTone(523.25, 0.09, 'sine', 0.12, 0);
    this.playTone(659.25, 0.12, 'sine', 0.12, 0.07);
  }

  playHit() {
    this.playTone(440, 0.05, 'square', 0.08);
  }

  playWall() {
    this.playTone(280, 0.04, 'triangle', 0.07);
  }

  playScore() {
    this.playTone(587.33, 0.1, 'triangle', 0.14, 0);
    this.playTone(880, 0.18, 'triangle', 0.14, 0.09);
  }

  playWater() {
    this.playTone(420, 0.08, 'sine', 0.1, 0);
    this.playTone(620, 0.1, 'sine', 0.1, 0.06);
  }

  playHarvest() {
    this.playTone(659.25, 0.08, 'triangle', 0.14, 0);
    this.playTone(783.99, 0.08, 'triangle', 0.14, 0.07);
    this.playTone(1046.5, 0.15, 'triangle', 0.14, 0.14);
  }

  playWrong() {
    this.playTone(220, 0.14, 'sawtooth', 0.1, 0);
    this.playTone(170, 0.22, 'sawtooth', 0.1, 0.12);
  }

  playWin() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.22, 'triangle', 0.15, idx * 0.09);
    });
  }

  playLose() {
    const notes = [392, 349.23, 311.13, 261.63];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.22, 'sawtooth', 0.09, idx * 0.11);
    });
  }
}

export const soundFX = new SoundEngine();
