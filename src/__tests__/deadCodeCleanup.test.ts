import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = path.resolve(__dirname, '..', '..')

describe('P2-1 dead code cleanup', () => {
  it('does not keep known unreferenced placeholder and legacy files', () => {
    const removedFiles = [
      'src/components/mood/MoodCalendar.vue',
      'src/components/shared/Footer.vue',
      'src/components/shared/Sidebar.vue',
      'src/views/mood/MoodRecordScript.ts',
      'mood_health_server/src/routes/aiRoutes.ts',
      'mood_health_server/src/utils/redisClient.ts',
    ]

    for (const relativePath of removedFiles) {
      expect(fs.existsSync(path.join(projectRoot, relativePath)), relativePath).toBe(false)
    }
  })
})
