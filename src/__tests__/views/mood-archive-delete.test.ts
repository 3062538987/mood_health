import { mount, flushPromises } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MoodArchive from '@/views/mood/MoodArchive.vue'
import { deleteMoodRecord, getMoodRecordList } from '@/api/mood'
import type { MoodRecord } from '@/types/mood'

const elementMocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
}))

vi.mock('@/api/mood', () => ({
  deleteMoodRecord: vi.fn(),
  getMoodRecordList: vi.fn(),
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    success: elementMocks.success,
    error: elementMocks.error,
  },
  ElMessageBox: {
    confirm: elementMocks.confirm,
  },
}))

vi.mock('vue-router', () => ({
  useRouter: () => routerMocks,
}))

const getMoodRecordListMock = vi.mocked(getMoodRecordList)
const deleteMoodRecordMock = vi.mocked(deleteMoodRecord)

const createMoodRecord = (overrides: Partial<MoodRecord> = {}): MoodRecord => ({
  id: '101',
  userId: '7',
  intensity: 6,
  moodType: ['happy'],
  moodRatio: [60],
  event: '完成了一次任务',
  tags: ['学习'],
  trigger: '任务完成',
  createTime: new Date().toISOString(),
  ...overrides,
})

const mountArchive = async (records: MoodRecord[] = [createMoodRecord()]) => {
  getMoodRecordListMock.mockResolvedValueOnce({
    list: records,
    total: records.length,
    page: 1,
    limit: 20,
  })

  const wrapper = mount(MoodArchive, {
    global: {
      stubs: {
        SoftEmptyState: true,
        SoftLoadingState: true,
        'el-button': {
          template: '<button type="button" @click="$emit(\'click\', $event)"><slot /></button>',
        },
        'el-dialog': {
          template: '<div><slot /><slot name="footer" /></div>',
        },
      },
    },
  })
  await flushPromises()
  return wrapper
}

describe('MoodArchive deletion flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes the record through the API before removing it from the archive', async () => {
    elementMocks.confirm.mockResolvedValueOnce('confirm')
    deleteMoodRecordMock.mockResolvedValueOnce(null)
    const wrapper = await mountArchive()

    expect(wrapper.findAll('.record-card')).toHaveLength(1)
    await wrapper.find('.delete-btn').trigger('click')
    await flushPromises()

    expect(deleteMoodRecordMock).toHaveBeenCalledWith(101)
    expect(wrapper.findAll('.record-card')).toHaveLength(0)
    expect(elementMocks.success).toHaveBeenCalled()
  })

  it('keeps the record visible when the delete request fails', async () => {
    elementMocks.confirm.mockResolvedValueOnce('confirm')
    deleteMoodRecordMock.mockRejectedValueOnce(new Error('network failed'))
    const wrapper = await mountArchive()

    await wrapper.find('.delete-btn').trigger('click')
    await flushPromises()

    expect(deleteMoodRecordMock).toHaveBeenCalledWith(101)
    expect(wrapper.findAll('.record-card')).toHaveLength(1)
    expect(elementMocks.error).toHaveBeenCalled()
  })

  it('does not request deletion when the user cancels confirmation', async () => {
    elementMocks.confirm.mockRejectedValueOnce(new Error('cancel'))
    const wrapper = await mountArchive()

    await wrapper.find('.delete-btn').trigger('click')
    await flushPromises()

    expect(deleteMoodRecordMock).not.toHaveBeenCalled()
    expect(wrapper.findAll('.record-card')).toHaveLength(1)
  })

  it('uses an explicit danger affordance with visible border and focus state', async () => {
    const wrapper = await mountArchive()
    const deleteButton = wrapper.get('.delete-btn')
    const source = readFileSync(resolve(process.cwd(), 'src/views/mood/MoodArchive.vue'), 'utf8')

    expect(deleteButton.text()).toContain('删除')
    expect(source).toContain('color: var(--danger)')
    expect(source).toContain('border: 1px solid var(--danger)')
    expect(source).toContain('&:focus-visible')
    expect(source).toContain('outline: 3px solid var(--focus)')
  })
})
