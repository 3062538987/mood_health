import { Request, Response } from 'express'
import {
  createNotificationService,
  NotificationService,
  NotificationServiceError,
} from '../services/notificationService'
import type { NotificationPreferences } from '../repositories/notificationRepository'
import {
  apiFailure,
  apiSuccess,
  API_ERROR_CODES,
  businessCodeForHttpStatus,
} from '../utils/apiResponse'
import logger from '../utils/logger'

const userIdOf = (request: Request): number => request.user?.userId ?? 0

export const createNotificationController = (
  service: NotificationService = createNotificationService()
) => {
  const fail = (response: Response, error: unknown) => {
    if (error instanceof NotificationServiceError) {
      response
        .status(error.statusCode)
        .json(apiFailure(businessCodeForHttpStatus(error.statusCode), error.message))
      return
    }
    logger.error('通知接口失败', { error: error instanceof Error ? error.message : String(error) })
    response.status(500).json(apiFailure(API_ERROR_CODES.INTERNAL_ERROR, '通知服务暂时不可用'))
  }

  const getPreferences = async (request: Request, response: Response) => {
    try {
      response.status(200).json(apiSuccess(await service.getPreferences(userIdOf(request))))
    } catch (error) {
      fail(response, error)
    }
  }

  const savePreferences = async (request: Request, response: Response) => {
    try {
      const saved = await service.savePreferences(
        userIdOf(request),
        request.body as NotificationPreferences
      )
      response.status(200).json(apiSuccess(saved, '设置已保存'))
    } catch (error) {
      fail(response, error)
    }
  }

  const listNotifications = async (request: Request, response: Response) => {
    try {
      await service.processDue(userIdOf(request))
      response.status(200).json(apiSuccess(await service.listNotifications(userIdOf(request))))
    } catch (error) {
      fail(response, error)
    }
  }

  const processDue = async (request: Request, response: Response) => {
    try {
      response.status(200).json(apiSuccess(await service.processDue(userIdOf(request))))
    } catch (error) {
      fail(response, error)
    }
  }

  const createTestNotification = async (request: Request, response: Response) => {
    try {
      response
        .status(201)
        .json(apiSuccess(await service.createTestNotification(userIdOf(request)), '测试提醒已发送'))
    } catch (error) {
      fail(response, error)
    }
  }

  const markRead = async (request: Request, response: Response) => {
    try {
      response
        .status(200)
        .json(apiSuccess(await service.markRead(userIdOf(request), Number(request.params.id))))
    } catch (error) {
      fail(response, error)
    }
  }

  return {
    getPreferences,
    savePreferences,
    listNotifications,
    processDue,
    createTestNotification,
    markRead,
  }
}

let defaultController: ReturnType<typeof createNotificationController> | null = null
const controller = () => {
  defaultController = defaultController ?? createNotificationController()
  return defaultController
}

export const getNotificationPreferences = (request: Request, response: Response) =>
  controller().getPreferences(request, response)
export const saveNotificationPreferences = (request: Request, response: Response) =>
  controller().savePreferences(request, response)
export const listUserNotifications = (request: Request, response: Response) =>
  controller().listNotifications(request, response)
export const processDueNotifications = (request: Request, response: Response) =>
  controller().processDue(request, response)
export const createTestUserNotification = (request: Request, response: Response) =>
  controller().createTestNotification(request, response)
export const markUserNotificationRead = (request: Request, response: Response) =>
  controller().markRead(request, response)
