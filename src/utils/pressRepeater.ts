export interface PressRepeater {
  start: (action: () => void) => void
  stop: () => void
}

export const createPressRepeater = (initialDelayMs = 180, repeatMs = 90): PressRepeater => {
  let delayTimer: ReturnType<typeof setTimeout> | null = null
  let repeatTimer: ReturnType<typeof setInterval> | null = null

  const stop = () => {
    if (delayTimer) clearTimeout(delayTimer)
    if (repeatTimer) clearInterval(repeatTimer)
    delayTimer = null
    repeatTimer = null
  }

  const start = (action: () => void) => {
    stop()
    action()
    delayTimer = setTimeout(() => {
      action()
      repeatTimer = setInterval(action, repeatMs)
    }, initialDelayMs)
  }

  return { start, stop }
}
