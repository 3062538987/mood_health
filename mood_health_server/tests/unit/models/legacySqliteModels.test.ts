import fs from 'node:fs'
import path from 'node:path'

const modelDir = path.resolve(__dirname, '../../../src/models')
const repoDir = path.resolve(__dirname, '../../../src/repositories')

const legacyModels = [
  'activityModel.ts',
  'postModel.ts',
  'commentModel.ts',
  'courseModel.ts',
  'musicModel.ts',
  'relaxModel.ts',
  'achievementModel.ts',
  'adviceModel.ts',
]

const replacementRepos = [
  'activityRepository.ts',
  'postRepository.ts',
  'courseRepository.ts',
  'musicRepository.ts',
  'relaxRepository.ts',
  'achievementRepository.ts',
]

describe('P1/P2 migration complete — legacy SQLite models removed', () => {
  it.each(legacyModels)('deletes legacy model file %s', (name) => {
    const filePath = path.join(modelDir, name)
    expect(fs.existsSync(filePath)).toBe(false)
  })

  it('aiModel.ts remains for AI utility use', () => {
    expect(fs.existsSync(path.join(modelDir, 'aiModel.ts'))).toBe(true)
  })

  it.each(replacementRepos)('has replacement MySQL repository %s', (name) => {
    expect(fs.existsSync(path.join(repoDir, name))).toBe(true)
  })
})