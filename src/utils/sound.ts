// 音效管理器
class SoundManager {
  private soundEnabled: boolean = true;
  private soundCache: Record<string, HTMLAudioElement> = {};
  private soundEffects: Record<string, string> = {
    woodenFish: '/audio/effects/woodenFish.mp3',
    paddleHit: '/audio/effects/paddleHit.mp3',
    brickBreak: '/audio/effects/brickBreak.mp3',
    gameOver: '/audio/effects/gameOver.mp3',
    tetrisRotate: '/audio/effects/tetrisRotate.mp3',
    tetrisClear: '/audio/effects/tetrisClear.mp3',
    tetrisDrop: '/audio/effects/tetrisDrop.mp3'
  };

  constructor() {
    // 从localStorage加载音效开关状态
    const savedSoundEnabled = localStorage.getItem('gameSound');
    if (savedSoundEnabled !== null) {
      this.soundEnabled = JSON.parse(savedSoundEnabled);
    }
  }

  /**
   * 设置音效开关状态
   */
  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    localStorage.setItem('gameSound', JSON.stringify(enabled));
  }

  /**
   * 获取音效开关状态
   */
  getSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  /**
   * 预加载音效
   */
  preloadSounds(): void {
    Object.entries(this.soundEffects).forEach(([key, path]) => {
      const audio = new Audio(path);
      audio.preload = 'auto';
      this.soundCache[key] = audio;
    });
  }

  /**
   * 播放音效
   */
  playSound(effectName: string): void {
    if (!this.soundEnabled) return;

    let audio = this.soundCache[effectName];
    if (!audio) {
      const path = this.soundEffects[effectName];
      if (!path) return;

      audio = new Audio(path);
      this.soundCache[effectName] = audio;
    }

    // 重置音频，确保可以重复播放
    audio.currentTime = 0;
    audio.play().catch(err => {
      console.warn('音效播放失败:', err);
    });
  }

  /**
   * 停止所有音效
   */
  stopAllSounds(): void {
    Object.values(this.soundCache).forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
  }
}

// 导出单例
export default new SoundManager();
