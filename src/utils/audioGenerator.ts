/**
 * 自然声音生成器 - 使用 Web Audio API 生成白噪音/粉噪音模拟自然声音
 * 无需外部音频文件，纯前端合成
 */

type SoundType = 'rain' | 'ocean' | 'fire'

class AudioGenerator {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private activeNodes: AudioNode[] = []
  private activeType: SoundType | null = null
  private isPlaying = false

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext()
    }
    return this.ctx
  }

  private createNoiseBuffer(duration: number, sampleRate: number): AudioBuffer {
    const buffer = this.getContext().createBuffer(1, duration * sampleRate, sampleRate)
    const data = buffer.getChannelData(0)
    // 生成粉噪音 (1/f noise)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.96900 * b2 + white * 0.1538520
      b3 = 0.86650 * b3 + white * 0.3104856
      b4 = 0.55000 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.0168980
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
      b6 = white * 0.115926
    }
    return buffer
  }

  private createWhiteNoiseBuffer(duration: number, sampleRate: number): AudioBuffer {
    const buffer = this.getContext().createBuffer(1, duration * sampleRate, sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1
    }
    return buffer
  }

  playRain(): void {
    this.stop()
    this.isPlaying = true
    this.activeType = 'rain'
    const ctx = this.getContext()
    const sampleRate = ctx.sampleRate

    this.masterGain = ctx.createGain()
    this.masterGain.gain.value = 0

    // 雨声：粉噪音 + 低通滤波
    const lowNoise = this.createNoiseBuffer(4, sampleRate)
    const lowSource = ctx.createBufferSource()
    lowSource.buffer = lowNoise
    lowSource.loop = true
    const lowFilter = ctx.createBiquadFilter()
    lowFilter.type = 'lowpass'
    lowFilter.frequency.value = 800
    lowFilter.Q.value = 0.5
    const lowGain = ctx.createGain()
    lowGain.gain.value = 0.5

    // 高频雨滴声
    const highNoise = this.createWhiteNoiseBuffer(2, sampleRate)
    const highSource = ctx.createBufferSource()
    highSource.buffer = highNoise
    highSource.loop = true
    const highFilter = ctx.createBiquadFilter()
    highFilter.type = 'bandpass'
    highFilter.frequency.value = 3000
    highFilter.Q.value = 1.5
    const highGain = ctx.createGain()
    highGain.gain.value = 0.15

    lowSource.connect(lowFilter).connect(lowGain).connect(this.masterGain)
    highSource.connect(highFilter).connect(highGain).connect(this.masterGain)
    this.masterGain.connect(ctx.destination)

    lowSource.start()
    highSource.start()
    this.activeNodes = [lowSource, highSource, lowFilter, highFilter, lowGain, highGain, this.masterGain]

    this.masterGain.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 0.5)
  }

  playOcean(): void {
    this.stop()
    this.isPlaying = true
    this.activeType = 'ocean'
    const ctx = this.getContext()
    const sampleRate = ctx.sampleRate

    this.masterGain = ctx.createGain()
    this.masterGain.gain.value = 0

    // 海浪：粉噪音 + LFO 调制音量
    const noise = this.createNoiseBuffer(4, sampleRate)
    const source = ctx.createBufferSource()
    source.buffer = noise
    source.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 600

    // LFO 模拟海浪起伏
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.08 // 约 12 秒一个周期
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.3
    const noiseGain = ctx.createGain()
    noiseGain.gain.value = 0.5

    lfo.connect(lfoGain).connect(noiseGain.gain)
    source.connect(filter).connect(noiseGain).connect(this.masterGain)
    this.masterGain.connect(ctx.destination)

    source.start()
    lfo.start()
    this.activeNodes = [source, filter, lfo, lfoGain, noiseGain, this.masterGain]

    this.masterGain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.8)
  }

  playFire(): void {
    this.stop()
    this.isPlaying = true
    this.activeType = 'fire'
    const ctx = this.getContext()
    const sampleRate = ctx.sampleRate

    this.masterGain = ctx.createGain()
    this.masterGain.gain.value = 0

    // 篝火：白噪音 + 带通滤波
    const noise = this.createWhiteNoiseBuffer(2, sampleRate)
    const source = ctx.createBufferSource()
    source.buffer = noise
    source.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 500
    filter.Q.value = 0.8

    // 低频爆裂声
    const crackleNoise = this.createWhiteNoiseBuffer(1, sampleRate)
    const crackleSource = ctx.createBufferSource()
    crackleSource.buffer = crackleNoise
    crackleSource.loop = true
    const crackleFilter = ctx.createBiquadFilter()
    crackleFilter.type = 'bandpass'
    crackleFilter.frequency.value = 200
    crackleFilter.Q.value = 2
    const crackleGain = ctx.createGain()
    crackleGain.gain.value = 0.1

    const noiseGain = ctx.createGain()
    noiseGain.gain.value = 0.6

    source.connect(filter).connect(noiseGain).connect(this.masterGain)
    crackleSource.connect(crackleFilter).connect(crackleGain).connect(this.masterGain)
    this.masterGain.connect(ctx.destination)

    source.start()
    crackleSource.start()
    this.activeNodes = [source, crackleSource, filter, crackleFilter, noiseGain, crackleGain, this.masterGain]

    this.masterGain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.3)
  }

  stop(): void {
    this.isPlaying = false
    this.activeType = null

    if (this.masterGain && this.ctx) {
      this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2)
    }

    // 延迟断开节点，让淡出生效
    setTimeout(() => {
      this.activeNodes.forEach((node) => {
        try { node.disconnect() } catch { /* ignore */ }
      })
      this.activeNodes = []
      if (this.masterGain) {
        try { this.masterGain.disconnect() } catch { /* ignore */ }
        this.masterGain = null
      }
    }, 300)
  }

  getIsPlaying(): boolean {
    return this.isPlaying
  }

  getActiveType(): SoundType | null {
    return this.activeType
  }

  setVolume(value: number): void {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.linearRampToValueAtTime(value, this.ctx.currentTime + 0.1)
    }
  }

  destroy(): void {
    this.stop()
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close()
      this.ctx = null
    }
  }
}

export const audioGenerator = new AudioGenerator()
export type { SoundType }