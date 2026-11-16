let audio: AudioContext | null = null

type Tone = 'start' | 'work' | 'rest' | 'done'

function audioCtor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined
  if ('AudioContext' in window) return window.AudioContext
  const legacy = window as Window & { webkitAudioContext?: typeof AudioContext }
  return legacy.webkitAudioContext
}

function ensureContext(): AudioContext | null {
  if (audio) return audio
  const Ctor = audioCtor()
  if (!Ctor) return null
  audio = new Ctor()
  return audio
}

/** Call from the Start gesture so iOS allows later beeps. */
export function unlockAudio(): void {
  const ctx = ensureContext()
  if (!ctx) return
  if (ctx.state !== 'running') void ctx.resume()
  const buffer = ctx.createBuffer(1, 1, 22_050)
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(ctx.destination)
  try {
    source.start()
  } catch {
    // The silent buffer is only an unlock pulse.
  }
}

export async function resumeAudio(): Promise<void> {
  if (!audio || audio.state === 'closed' || audio.state === 'running') return
  try {
    await audio.resume()
  } catch {
    // Resume can fail when the page is not allowed to play yet.
  }
}

export async function playPattern(kind: Tone): Promise<void> {
  const ctx = ensureContext()
  if (!ctx) return
  if (ctx.state !== 'running') {
    try {
      await ctx.resume()
    } catch {
      return
    }
  }
  const startAt = ctx.currentTime + 0.02
  if (kind === 'start') {
    tone(ctx, startAt, 740, 0.12, 0.12)
    return
  }
  if (kind === 'work') {
    tone(ctx, startAt, 880, 0.1, 0.16)
    tone(ctx, startAt + 0.14, 1174, 0.14, 0.16)
    return
  }
  if (kind === 'rest') {
    tone(ctx, startAt, 494, 0.1, 0.15)
    tone(ctx, startAt + 0.14, 659, 0.14, 0.15)
    return
  }
  tone(ctx, startAt, 523.25, 0.12, 0.16)
  tone(ctx, startAt + 0.16, 659.25, 0.12, 0.16)
  tone(ctx, startAt + 0.32, 783.99, 0.24, 0.18)
}

function tone(
  ctx: AudioContext,
  when: number,
  frequency: number,
  duration: number,
  peak: number,
): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(frequency, when)
  gain.gain.setValueAtTime(0.0001, when)
  gain.gain.exponentialRampToValueAtTime(peak, when + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.onended = () => {
    osc.disconnect()
    gain.disconnect()
  }
  osc.start(when)
  osc.stop(when + duration + 0.03)
}
