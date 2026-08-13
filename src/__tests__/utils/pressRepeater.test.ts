import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPressRepeater } from '@/utils/pressRepeater'

describe('pressRepeater', () => {
  afterEach(() => vi.useRealTimers())

  it('moves immediately and then repeats while the control stays pressed', () => {
    vi.useFakeTimers()
    const action = vi.fn()
    const repeater = createPressRepeater(180, 90)

    repeater.start(action)
    expect(action).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(360)
    expect(action.mock.calls.length).toBeGreaterThanOrEqual(4)

    repeater.stop()
    const callsAfterStop = action.mock.calls.length
    vi.advanceTimersByTime(500)
    expect(action).toHaveBeenCalledTimes(callsAfterStop)
  })
})
