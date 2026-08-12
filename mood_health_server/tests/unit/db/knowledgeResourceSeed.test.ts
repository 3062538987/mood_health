import { seedKnowledgeResources } from '../../../src/db/seeds/knowledgeResourceSeed'
import type { SeedDatabase } from '../../../src/db/seeds/coreSeed'

type StoredResource = {
  slug: string
  title: string
  sourceUrl: string
  licenseCode: string
}

const makeDatabase = () => {
  let folderCreated = false
  const resources = new Map<string, StoredResource>()
  const db: SeedDatabase = {
    query: async <T>(sql: string, params: unknown[] = []) => {
      if (sql.includes('INSERT INTO knowledge_folders')) {
        folderCreated = true
        return [] as T[]
      }
      if (sql.includes('SELECT id FROM knowledge_folders')) {
        return (folderCreated ? [{ id: 1 }] : []) as T[]
      }
      if (sql.includes('INSERT INTO knowledge_resources')) {
        const slug = String(params[1])
        resources.set(slug, {
          slug,
          title: String(params[2]),
          sourceUrl: String(params[5]),
          licenseCode: String(params[6]),
        })
        return [] as T[]
      }
      return [] as T[]
    },
  }
  return { db, resources }
}

describe('seedKnowledgeResources', () => {
  it('seeds traceable official resources idempotently', async () => {
    const { db, resources } = makeDatabase()

    const first = await seedKnowledgeResources(db)
    const second = await seedKnowledgeResources(db)

    expect(first.count).toBeGreaterThanOrEqual(8)
    expect(second.count).toBe(first.count)
    expect(resources.size).toBe(first.count)
    expect(resources.get('who-doing-what-matters')).toMatchObject({
      licenseCode: 'CC-BY-NC-SA-3.0-IGO',
      sourceUrl: 'https://www.who.int/publications/b/53604',
    })
    expect([...resources.values()].every((resource) => resource.sourceUrl.startsWith('https://'))).toBe(
      true
    )
  })

  it('never stores a resource without an explicit license policy', async () => {
    const { db, resources } = makeDatabase()

    await seedKnowledgeResources(db)

    expect([...resources.values()].every((resource) => resource.licenseCode.length > 0)).toBe(true)
  })
})
