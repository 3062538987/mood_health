import { Request, Response } from 'express'
import {
  createKnowledgeResourceService,
  KnowledgeResourceService,
  KnowledgeResourceServiceError,
} from '../services/knowledgeResourceService'
import {
  apiFailure,
  apiSuccess,
  businessCodeForHttpStatus,
  API_ERROR_CODES,
} from '../utils/apiResponse'
import logger from '../utils/logger'

const getUserId = (request: Request): number | null => request.user?.userId ?? null

const parseOptionalInteger = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined
  return Number(value)
}

const getErrorContract = (error: unknown): { statusCode: number; message: string } | null => {
  if (error instanceof KnowledgeResourceServiceError) {
    return { statusCode: error.statusCode, message: error.message }
  }
  if (typeof error !== 'object' || error === null) return null
  const candidate = error as { statusCode?: unknown; message?: unknown }
  if (typeof candidate.statusCode !== 'number' || typeof candidate.message !== 'string') return null
  return { statusCode: candidate.statusCode, message: candidate.message }
}

export const createKnowledgeResourceController = (
  service: KnowledgeResourceService = createKnowledgeResourceService()
) => {
  const respondWithError = (response: Response, error: unknown): void => {
    const contract = getErrorContract(error)
    if (contract) {
      response
        .status(contract.statusCode)
        .json(apiFailure(businessCodeForHttpStatus(contract.statusCode), contract.message))
      return
    }
    logger.error('知识资料接口失败', { error: error instanceof Error ? error.message : String(error) })
    response
      .status(500)
      .json(apiFailure(API_ERROR_CODES.INTERNAL_ERROR, '知识资料服务暂时不可用'))
  }

  const requireUserId = (request: Request, response: Response): number | null => {
    const userId = getUserId(request)
    if (userId === null) {
      response.status(401).json(apiFailure(API_ERROR_CODES.UNAUTHORIZED, '请先登录'))
      return null
    }
    return userId
  }

  const listFolders = async (request: Request, response: Response): Promise<void> => {
    const userId = requireUserId(request, response)
    if (userId === null) return
    try {
      const folders = await service.listFolders(userId)
      response.status(200).json(apiSuccess(folders, '获取资料文件夹成功'))
    } catch (error) {
      respondWithError(response, error)
    }
  }

  const listResources = async (request: Request, response: Response): Promise<void> => {
    const userId = requireUserId(request, response)
    if (userId === null) return
    try {
      const result = await service.listResources({
        userId,
        page: parseOptionalInteger(request.query.page),
        pageSize: parseOptionalInteger(request.query.pageSize),
        folderId: parseOptionalInteger(request.query.folderId),
        search: typeof request.query.search === 'string' ? request.query.search : undefined,
      })
      response.status(200).json(apiSuccess(result, '获取资料列表成功'))
    } catch (error) {
      respondWithError(response, error)
    }
  }

  const getResource = async (request: Request, response: Response): Promise<void> => {
    const userId = requireUserId(request, response)
    if (userId === null) return
    try {
      const resource = await service.getResource({
        userId,
        resourceId: Number(request.params.id),
      })
      response.status(200).json(apiSuccess(resource, '获取资料详情成功'))
    } catch (error) {
      respondWithError(response, error)
    }
  }

  const setFavorite = async (request: Request, response: Response): Promise<void> => {
    const userId = requireUserId(request, response)
    if (userId === null) return
    try {
      if (typeof request.body?.favorite !== 'boolean') {
        throw new KnowledgeResourceServiceError('BAD_REQUEST', 400, 'favorite 必须是布尔值')
      }
      const favorite = await service.setFavorite({
        userId,
        resourceId: Number(request.params.id),
        favorite: request.body.favorite,
      })
      response.status(200).json(apiSuccess({ favorite }, '收藏状态已更新'))
    } catch (error) {
      respondWithError(response, error)
    }
  }

  return { listFolders, listResources, getResource, setFavorite }
}

let defaultController: ReturnType<typeof createKnowledgeResourceController> | null = null
const getDefaultController = () => {
  defaultController = defaultController ?? createKnowledgeResourceController()
  return defaultController
}

export const listKnowledgeFolders = (request: Request, response: Response) =>
  getDefaultController().listFolders(request, response)
export const listKnowledgeResources = (request: Request, response: Response) =>
  getDefaultController().listResources(request, response)
export const getKnowledgeResource = (request: Request, response: Response) =>
  getDefaultController().getResource(request, response)
export const setKnowledgeResourceFavorite = (request: Request, response: Response) =>
  getDefaultController().setFavorite(request, response)
