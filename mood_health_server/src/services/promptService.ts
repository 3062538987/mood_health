import { createPromptRepository, type PromptRepository, type CreatePromptInput, type UpdatePromptInput, type PromptTemplate, type PromptCategory } from '../repositories/promptRepository'

let repository: PromptRepository | null = null

const getRepository = (): PromptRepository => {
  if (!repository) {
    repository = createPromptRepository()
  }
  return repository
}

export const createPromptService = (repo?: PromptRepository) => {
  const r = repo || getRepository()

  const listTemplates = async () => r.findAll()

  const getTemplate = async (id: number) => r.findById(id)

  const createTemplate = async (input: CreatePromptInput) => r.create(input)

  const updateTemplate = async (id: number, input: UpdatePromptInput) => {
    const updated = await r.update(id, input)
    if (!updated) throw new Error('Prompt 模板不存在')
    return updated
  }

  const deleteTemplate = async (id: number) => {
    const deleted = await r.remove(id)
    if (!deleted) throw new Error('Prompt 模板不存在')
  }

  const getActiveByCategory = async (category: PromptCategory): Promise<PromptTemplate[]> => {
    return r.findActiveByCategory(category)
  }

  return { listTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate, getActiveByCategory }
}

export type PromptService = ReturnType<typeof createPromptService>

const promptService = createPromptService()
export default promptService