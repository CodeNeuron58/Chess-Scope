/** Move sounds synthesised with Web Audio — no audio files to ship. */
let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function knock(freq: number, duration: number, gain: number) {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime
  const osc = ac.createOscillator()
  const amp = ac.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq, t)
  osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + duration)
  amp.gain.setValueAtTime(gain, t)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  osc.connect(amp).connect(ac.destination)
  osc.start(t)
  osc.stop(t + duration + 0.02)
}

export function playMoveSound(kind: 'move' | 'capture' | 'check') {
  if (kind === 'capture') knock(180, 0.12, 0.35)
  else if (kind === 'check') {
    knock(520, 0.09, 0.22)
    setTimeout(() => knock(660, 0.1, 0.18), 70)
  } else knock(320, 0.08, 0.25)
}

export function soundFor(san: string): 'move' | 'capture' | 'check' {
  if (san.includes('+') || san.includes('#')) return 'check'
  return san.includes('x') ? 'capture' : 'move'
}
