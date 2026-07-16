import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import promptService from '../services/promptService'
import { apiSuccess, apiFailure } from '../utils/apiResponse'
import { logOperation } from '../utils/operationLogger'

const getClientIp = (req: AuthRequest): string => {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }
  return req.ip || '-'
}

export const listPromptsHandler = async (req: AuthRequest, res: Response) => {
  try {
    const templates = await promptService.listTemplates()
    return res.status(200).json(apiSuccess(templates))
  } catch (error) {
    return res.status(500).json(apiFailure(500, '获取 Prompt 列表失败'))
  }
}

export const getPromptHandler = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json(apiFailure(400, 'id 必须是正整数'))
    }
    const template = await promptService.getTemplate(id)
    if (!template) {
      return res.status(404).json(apiFailure(404, 'Prompt 模板不存在'))
    }
    return res.status(200).json(apiSuccess(template))
  } catch (error) {
    return res.status(500).json(apiFailure(500, '获取 Prompt 详情失败'))
  }
}

export const createPromptHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { name, category, systemPrompt, userPromptTemplate, variables, model, temperature, maxTokens, sortOrder } = req.body
    if (!name || !category || !systemPrompt || !userPromptTemplate) {
      return res.status(400).json(apiFailure(400, 'name, category, systemPrompt, userPromptTemplate 为必填'))
    }
    const template = await promptService.createTemplate({
      name, category, systemPrompt, userPromptTemplate, variables, model, temperature, maxTokens, sortOrder,
    })
    await logOperation(req.user!.userId, req.user!.role, 'prompt.manage', 'PROMPT_CREATE', String(template.id), `name=${name}`, 'success', getClientIp(req))
    return res.status(201).json(apiSuccess(template, 'Prompt 模板创建成功'))
  } catch (error: any) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json(apiFailure(409, 'Prompt 模板名称已存在'))
    }
    return res.status(500).json(apiFailure(500, '创建 Prompt 模板失败'))
  }
}

export const updatePromptHandler = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json(apiFailure(400, 'id 必须是正整数'))
    }
    const template = await promptService.updateTemplate(id, req.body)
    await logOperation(req.user!.userId, req.user!.role, 'prompt.manage', 'PROMPT_UPDATE', String(id), '', 'success', getClientIp(req))
    return res.status(200).json(apiSuccess(template, 'Prompt 模板更新成功'))
  } catch (error: any) {
    if (error?.message === 'Prompt 模板不存在') {
      return res.status(404).json(apiFailure(404, 'Prompt 模板不存在'))
    }
    return res.status(500).json(apiFailure(500, '更新 Prompt 模板失败'))
  }
}

export const deletePromptHandler = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json(apiFailure(400, 'id 必须是正整数'))
    }
    await promptService.deleteTemplate(id)
    await logOperation(req.user!.userId, req.user!.role, 'prompt.manage', 'PROMPT_DELETE', String(id), '', 'success', getClientIp(req))
    return res.status(200).json(apiSuccess(null, 'Prompt 模板已删除'))
  } catch (error: any) {
    if (error?.message === 'Prompt 模板不存在') {
      return res.status(404).json(apiFailure(404, 'Prompt 模板不存在'))
    }
    return res.status(500).json(apiFailure(500, '删除 Prompt 模板失败'))
  }
}