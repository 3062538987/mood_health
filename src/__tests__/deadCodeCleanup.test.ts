import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = path.resolve(__dirname, '..', '..')

describe('P2-1 dead code cleanup', () => {
  it('does not keep known unreferenced placeholder and legacy files', () => {
    const removedFiles = [
      'mood_health_server/src/utils/redisClient.ts',
    ]

    for (const relativePath of removedFiles) {
      expect(fs.existsSync(path.join(projectRoot, relativePath)), relativePath).toBe(false)
    }
  })

  it('does not log sensitive mood payloads or leftover game debug messages', () => {
    const sensitiveSources = [
      'src/stores/moodRecordStore.ts',
      'src/components/relax/PinballGame.vue',
      'src/views/mood/MoodAnalysis.vue',
    ].map((relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8'))

    expect(sensitiveSources.join('\n')).not.toMatch(/console\.log\(/)
  })
})
