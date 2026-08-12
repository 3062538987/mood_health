import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import KnowledgeUploadForm from '@/components/knowledge/KnowledgeUploadForm.vue'
import { uploadKnowledgeResource } from '@/api/knowledgeResources'

vi.mock('@/api/knowledgeResources', () => ({ uploadKnowledgeResource: vi.fn() }))

const uploadMock = vi.mocked(uploadKnowledgeResource)

describe('KnowledgeUploadForm', () => {
  beforeEach(() => {
    uploadMock.mockReset().mockResolvedValue({ id: 20, title: '压力管理练习' } as never)
  })

  it('submits the selected file and metadata through the real upload API contract', async () => {
    const wrapper = mount(KnowledgeUploadForm)
    await wrapper.get('[data-test="upload-title"]').setValue('压力管理练习')
    await wrapper.get('[data-test="upload-summary"]').setValue('老师上传的课堂练习资料')
    const file = new File(['%PDF-1.7\nbody'], 'exercise.pdf', { type: 'application/pdf' })
    const input = wrapper.get('[data-test="upload-file"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(uploadMock).toHaveBeenCalledWith({
      title: '压力管理练习',
      summary: '老师上传的课堂练习资料',
      licenseCode: undefined,
      file,
    })
    expect(wrapper.emitted('uploaded')?.[0]?.[0]).toEqual(
      expect.objectContaining({ id: 20 })
    )
    expect(wrapper.get('[role="status"]').text()).toContain('资料上传成功')
  })

  it('blocks submission until a supported file is selected', async () => {
    const wrapper = mount(KnowledgeUploadForm)
    await wrapper.get('[data-test="upload-title"]').setValue('资料')
    await wrapper.get('[data-test="upload-summary"]').setValue('简介')

    await wrapper.get('form').trigger('submit')

    expect(uploadMock).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toContain('请选择 PDF、DOCX 或 TXT 文件')
  })
})
