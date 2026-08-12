import { createNotificationService } from '../../../src/services/notificationService'

const defaultPreferences = {
  reminderTime: '20:00',
  weeklyReportEnabled: true,
  gameSoundEnabled: true,
  emotionReminderEnabled: true,
  weeklyReportNotificationEnabled: true,
  groupActivityEnabled: true,
  treeholeReplyEnabled: true,
  featureUpdateEnabled: true,
}

const makeRepository = () => ({
  getPreferences: jest.fn().mockResolvedValue(defaultPreferences),
  savePreferences: jest.fn().mockImplementation(async (_userId, value) => value),
  hasMoodOnDate: jest.fn().mockResolvedValue(false),
  createNotificationIfAbsent: jest.fn().mockImplementation(async (input) => ({ id: 1, ...input, readAt: null })),
  listNotifications: jest.fn().mockResolvedValue([]),
  markRead: jest.fn().mockResolvedValue(true),
})

describe('notificationService', () => {
  it('creates one due emotion reminder after the configured time when no mood exists', async () => {
    const repository = makeRepository()
    const now = new Date('2026-08-13T20:15:00+08:00')
    const service = createNotificationService({ repository: repository as never, now: () => now })

    const created = await service.processDue(7)

    expect(repository.hasMoodOnDate).toHaveBeenCalledWith(7, '2026-08-13')
    expect(repository.createNotificationIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        notificationType: 'emotion_reminder',
        dedupeKey: 'emotion-reminder:2026-08-13',
      })
    )
    expect(created).toHaveLength(1)
  })

  it('does not create an emotion reminder before its configured time', async () => {
    const repository = makeRepository()
    const service = createNotificationService({
      repository: repository as never,
      now: () => new Date('2026-08-13T19:59:00+08:00'),
    })

    await service.processDue(7)

    expect(repository.hasMoodOnDate).not.toHaveBeenCalled()
    expect(repository.createNotificationIfAbsent).not.toHaveBeenCalled()
  })

  it('creates a weekly report notification on Monday when both weekly switches are enabled', async () => {
    const repository = makeRepository()
    repository.hasMoodOnDate.mockResolvedValue(true)
    const service = createNotificationService({
      repository: repository as never,
      now: () => new Date('2026-08-10T09:05:00+08:00'),
    })

    await service.processDue(7)

    expect(repository.createNotificationIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationType: 'weekly_report',
        dedupeKey: 'weekly-report:2026-08-10',
        actionPath: '/mood/analysis',
      })
    )
  })

  it('rejects malformed reminder times instead of silently saving them', async () => {
    const service = createNotificationService({ repository: makeRepository() as never })

    await expect(
      service.savePreferences(7, { ...defaultPreferences, reminderTime: '25:30' })
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('creates an immediate test notification that can be displayed by the client', async () => {
    const repository = makeRepository()
    const service = createNotificationService({
      repository: repository as never,
      now: () => new Date('2026-08-13T10:00:00+08:00'),
    })

    const notification = await service.createTestNotification(7)

    expect(notification.title).toBe('提醒测试成功')
    expect(repository.createNotificationIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({ notificationType: 'test', userId: 7 })
    )
  })
})
