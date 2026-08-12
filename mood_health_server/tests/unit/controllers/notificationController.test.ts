import { createNotificationController } from '../../../src/controllers/notificationController'

const makeResponse = () => {
  const response = { status: jest.fn(), json: jest.fn() }
  response.status.mockReturnValue(response)
  response.json.mockReturnValue(response)
  return response
}

const makeService = () => ({
  getPreferences: jest.fn().mockResolvedValue({ reminderTime: '20:00' }),
  savePreferences: jest.fn().mockImplementation(async (_userId, body) => body),
  processDue: jest.fn().mockResolvedValue([]),
  createTestNotification: jest.fn().mockResolvedValue({ id: 3, title: '提醒测试成功' }),
  listNotifications: jest.fn().mockResolvedValue([]),
  markRead: jest.fn().mockResolvedValue({ read: true }),
})

describe('notificationController', () => {
  it('persists authenticated user preferences through the service', async () => {
    const service = makeService()
    const controller = createNotificationController(service as never)
    const response = makeResponse()
    const body = { reminderTime: '21:00', weeklyReportEnabled: true }

    await controller.savePreferences(
      { user: { userId: 7 }, body } as never,
      response as never
    )

    expect(service.savePreferences).toHaveBeenCalledWith(7, body)
    expect(response.status).toHaveBeenCalledWith(200)
  })

  it('processes due items before returning the current notification list', async () => {
    const service = makeService()
    const controller = createNotificationController(service as never)
    const response = makeResponse()

    await controller.listNotifications({ user: { userId: 7 } } as never, response as never)

    expect(service.processDue).toHaveBeenCalledWith(7)
    expect(service.listNotifications).toHaveBeenCalledWith(7)
  })
})
