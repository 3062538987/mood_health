import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import ElementPlus from 'element-plus'

vi.mock('@/utils/request', () => ({
  default: vi.fn(),
}))

import request from '@/utils/request'
import AdminAssessments from '@/views/admin/AdminAssessments.vue'

const requestMock = vi.mocked(request)

const SAMPLE_LIST = {
  list: [
    {
      id: 1,
      userId: 7,
      username: 'alice',
      instrumentName: 'PHQ-9',
      rawScore: 12,
      screeningLevel: 'moderate',
      status: 'submitted',
      startedAt: '2026-01-01T00:00:00Z',
      submittedAt: '2026-01-01T00:05:00Z',
    },
    {
      id: 2,
      userId: 9,
      username: 'bob',
      instrumentName: 'GAD-7',
      rawScore: 4,
      screeningLevel: 'mild',
      status: 'submitted',
      startedAt: '2026-01-02T00:00:00Z',
      submittedAt: '2026-01-02T00:05:00Z',
    },
  ],
  total: 2,
  page: 1,
  pageSize: 20,
}

describe('测评管理后台 - 导出与复核', () => {
  let capturedCsv = ''

  beforeEach(() => {
    requestMock.mockResolvedValue(SAMPLE_LIST)
    capturedCsv = ''
    const RealBlob = (globalThis as any).Blob
    vi.stubGlobal(
      'Blob',
      class extends RealBlob {
        constructor(parts: any, opts?: any) {
          capturedCsv = Array.isArray(parts) ? parts.join('') : String(parts)
          super(parts, opts)
        }
      },
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  })

  it('点击「导出 CSV」生成含表头与中文风险等级的 CSV', async () => {
    const wrapper = mount(AdminAssessments, {
      global: {
        plugins: [ElementPlus],
        stubs: { 'el-dialog': { template: '<div><slot /></div>' } },
      },
    })
    await flushPromises()

    const exportBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('导出 CSV'))
    expect(exportBtn).toBeTruthy()
    await exportBtn!.trigger('click')

    expect(capturedCsv).toContain(
      'ID,用户,测评量表,原始分,筛查等级,状态,提交时间,已复核',
    )
    expect(capturedCsv).toContain('alice')
    expect(capturedCsv).toContain('PHQ-9')
    expect(capturedCsv).toContain('中度') // moderate -> 中文
    expect(capturedCsv).toContain('轻度') // mild -> 中文
    expect(capturedCsv).toContain('1/1') // 提交时间已格式化
  })

  it('点击「标记复核」后切换为「已复核」本地状态', async () => {
    const wrapper = mount(AdminAssessments, {
      global: {
        plugins: [ElementPlus],
        stubs: { 'el-dialog': { template: '<div><slot /></div>' } },
      },
    })
    await flushPromises()

    const reviewBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('标记复核'))
    expect(reviewBtn).toBeTruthy()

    await reviewBtn!.trigger('click')
    const after = wrapper
      .findAll('button')
      .find((b) => b.text().includes('已复核') || b.text().includes('标记复核'))
    expect(after?.text()).toContain('已复核')
  })
})
