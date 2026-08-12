import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { ElMessage } from 'element-plus'
import MoodAnalysis from '@/views/mood/MoodAnalysis.vue'

// 切断网络与重子组件（ECharts 等），只验证 generateAnalysis 对
// createAnalysis 返回 null（无情绪记录）的空值守卫，避免 created.id 崩溃。
vi.mock('@/api/moodAnalysis', () => ({
  getLatestAnalysis: vi.fn().mockResolvedValue(null),
  retryAnalysis: vi.fn().mockResolvedValue({}),
  createAnalysis: vi.fn(),
  getAnalysisHistory: vi.fn().mockResolvedValue({ data: [] }),
}))

vi.mock('@/api/moodInsight', () => ({
  getMoodInsight: vi.fn().mockResolvedValue({ summary: { totalRecords: 0 } }),
}))

import { createAnalysis, retryAnalysis, getLatestAnalysis } from '@/api/moodAnalysis'

type MoodAnalysisVm = {
  generateAnalysis: () => Promise<void>
  latestAnalysis: unknown
}

describe('MoodAnalysis.generateAnalysis — createAnalysis 返回 null 守卫', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(ElMessage, 'warning').mockImplementation(() => ({ close: () => {} }) as never)
  })

  it('createAnalysis 返回 null（无情绪记录）时不崩溃、提前返回且不触发轮询', async () => {
    ;(createAnalysis as unknown as Mock).mockResolvedValue(null)

    const wrapper = shallowMount(MoodAnalysis)
    const vm = wrapper.vm as unknown as MoodAnalysisVm
    await vm.generateAnalysis()

    expect(createAnalysis).toHaveBeenCalledTimes(1)
    // 守卫提前 return，不应进入 triggerAndPoll → 不调用 runAnalysis 轮询
    expect(retryAnalysis).not.toHaveBeenCalled()
    expect(vm.latestAnalysis).toBeNull()
    expect(ElMessage.warning).toHaveBeenCalled()
  })

  it('createAnalysis 返回有效对象时继续触发轮询（不抛错）', async () => {
    ;(createAnalysis as unknown as Mock).mockResolvedValue({
      id: 'v-1',
      period: '7d',
      status: 'pending',
      createdAt: '',
      updatedAt: '',
    })
    // 让 pollUntilDone 第一次轮询即拿到 succeeded，避免进入 70s 轮询循环
    ;(getLatestAnalysis as unknown as Mock).mockResolvedValue({
      status: 'succeeded',
      result: { summary: 'ok', patterns: [], possibleFactors: [], actions: [], whenToSeekHelp: '', warnings: [] },
    })

    const wrapper = shallowMount(MoodAnalysis)
    const vm = wrapper.vm as unknown as MoodAnalysisVm
    // 不应抛出 created.id 之类的 TypeError；轮询拿到结果后 latestAnalysis 被填充
    await expect(vm.generateAnalysis()).resolves.toBeUndefined()
    expect(createAnalysis).toHaveBeenCalledTimes(1)
    expect(vm.latestAnalysis).not.toBeNull()
  })
})
