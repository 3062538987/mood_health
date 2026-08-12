import { createKnowledgeUploadService } from '../../../src/services/knowledgeUploadService'
import type { KnowledgeResourceDto } from '../../../src/repositories/knowledgeResourceRepository'
import type { KnowledgeUploadFile } from '../../../src/services/knowledgeUploadPolicy'

const uploadedResource: KnowledgeResourceDto = {
  id: 20,
  folderId: 2,
  folderSlug: 'user-7-uploads',
  title: '压力管理练习',
  summary: '老师上传的课堂练习资料',
  resourceType: 'document',
  sourceUrl: null,
  downloadUrl: '/api/knowledge-resources/20/download',
  licenseCode: 'TEACHER_UPLOADED',
  isBuiltin: false,
  ingestionStatus: 'ready',
  reviewedAt: null,
  favorited: false,
  createdAt: '2026-08-13T00:00:00.000Z',
  updatedAt: '2026-08-13T00:00:00.000Z',
}

const pdfFile: KnowledgeUploadFile = {
  fieldname: 'file',
  originalname: 'exercise.pdf',
  encoding: '7bit',
  mimetype: 'application/pdf',
  size: 12,
  buffer: Buffer.from('%PDF-1.7\nbody'),
}

const makeDependencies = () => {
  const repository = {
    createUploadedResource: jest.fn().mockResolvedValue(uploadedResource),
    findFileById: jest.fn(),
  }
  const fileStore = {
    save: jest.fn().mockResolvedValue('75ee01.pdf'),
    remove: jest.fn().mockResolvedValue(undefined),
    resolve: jest.fn(),
  }
  return { repository, fileStore }
}

describe('knowledgeUploadService', () => {
  it('stores a validated counselor upload and persists traceable metadata', async () => {
    const dependencies = makeDependencies()
    const service = createKnowledgeUploadService(dependencies as never)

    await expect(
      service.upload({
        userId: 7,
        role: 'counselor',
        title: ' 压力管理练习 ',
        summary: ' 老师上传的课堂练习资料 ',
        licenseCode: '',
        file: pdfFile,
      })
    ).resolves.toEqual(uploadedResource)

    expect(dependencies.fileStore.save).toHaveBeenCalledWith(pdfFile.buffer, '.pdf')
    expect(dependencies.repository.createUploadedResource).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerUserId: 7,
        folderSlug: 'user-7-uploads',
        title: '压力管理练习',
        summary: '老师上传的课堂练习资料',
        storageKey: '75ee01.pdf',
        licenseCode: 'TEACHER_UPLOADED',
        contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      })
    )
  })

  it('rejects students before writing any untrusted file', async () => {
    const dependencies = makeDependencies()
    const service = createKnowledgeUploadService(dependencies as never)

    await expect(
      service.upload({
        userId: 7,
        role: 'student',
        title: '资料',
        summary: '简介',
        file: pdfFile,
      })
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(dependencies.fileStore.save).not.toHaveBeenCalled()
  })

  it('removes the stored file when database persistence fails', async () => {
    const dependencies = makeDependencies()
    dependencies.repository.createUploadedResource.mockRejectedValueOnce(new Error('db failed'))
    const service = createKnowledgeUploadService(dependencies as never)

    await expect(
      service.upload({
        userId: 7,
        role: 'admin',
        title: '压力管理练习',
        summary: '老师上传的课堂练习资料',
        file: pdfFile,
      })
    ).rejects.toThrow('db failed')
    expect(dependencies.fileStore.remove).toHaveBeenCalledWith('75ee01.pdf')
  })
})
