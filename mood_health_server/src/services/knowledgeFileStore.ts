import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

export interface KnowledgeFileStore {
  save(buffer: Buffer, extension: '.pdf' | '.docx' | '.txt'): Promise<string>
  remove(storageKey: string): Promise<void>
  resolve(storageKey: string): string
}

const defaultStorageDirectory = path.resolve(__dirname, '../../storage/knowledge')

export const createKnowledgeFileStore = (
  rootDirectory = process.env.KNOWLEDGE_STORAGE_DIR
    ? path.resolve(process.env.KNOWLEDGE_STORAGE_DIR)
    : defaultStorageDirectory
): KnowledgeFileStore => {
  const resolve = (storageKey: string): string => {
    if (path.basename(storageKey) !== storageKey || !/^[a-f0-9-]+\.(pdf|docx|txt)$/.test(storageKey)) {
      throw new Error('invalid knowledge storage key')
    }
    const target = path.resolve(rootDirectory, storageKey)
    if (path.dirname(target) !== rootDirectory) {
      throw new Error('knowledge storage path escaped its root')
    }
    return target
  }

  const save: KnowledgeFileStore['save'] = async (buffer, extension) => {
    await mkdir(rootDirectory, { recursive: true })
    const storageKey = `${randomUUID()}${extension}`
    await writeFile(resolve(storageKey), buffer, { flag: 'wx', mode: 0o600 })
    return storageKey
  }

  const remove = async (storageKey: string): Promise<void> => {
    await rm(resolve(storageKey), { force: true })
  }

  return { save, remove, resolve }
}
