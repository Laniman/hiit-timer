let sentinel: WakeLockSentinel | null = null
let pending = false

export function wakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator
}

export async function acquireWakeLock(): Promise<void> {
  if (!wakeLockSupported() || sentinel || pending) return
  pending = true
  try {
    const lock = await navigator.wakeLock.request('screen')
    sentinel = lock
    lock.addEventListener('release', () => {
      if (sentinel === lock) sentinel = null
    })
  } catch {
    // iOS refuses the lock when the page is hidden, low-power, or unsupported.
  } finally {
    pending = false
  }
}

export async function releaseWakeLock(): Promise<void> {
  const lock = sentinel
  sentinel = null
  if (!lock) return
  try {
    await lock.release()
  } catch {
    // Already released by the browser.
  }
}
