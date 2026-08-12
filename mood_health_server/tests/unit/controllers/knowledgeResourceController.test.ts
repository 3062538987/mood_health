import { createKnowledgeResourceController } from '../../../src/controllers/knowledgeResourceController'
import type { KnowledgeResourceService } from '../../../src/services/knowledgeResourceService'
import type { KnowledgeUploadService } from '../../../src/services/knowledgeUploadService'

const makeResponse = () => {
  const response = { status: jest.fn(), json: jest.fn() }
  response.status.mockReturnValue(response)
  response.json.mockReturnValue(response)
  return response
}

const makeService = (): KnowledgeResourceService =>
  ({
    listFolders: jest.fn().mockResolvedValue([
      { id: 1, slug: 'builtin', name: '内置资料', isBuiltin: true },
    ]),
    listResources: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    getResource: jest.fn(),
    setFavorite: jest.fn(),
    assertCanModifyResource: jest.fn(),
  }) as unknown as KnowledgeResourceService

const makeUploadService = (): KnowledgeUploadService =>
  ({
    upload: jest.fn().mockResolvedValue({ id: 20, title: '压力管理练习' }),
    getDownload: jest.fn(),
  }) as unknown as KnowledgeUploadService

describe('knowledgeResourceController', () => {
  it('returns folders in the standard success envelope', async () => {
    const service = makeService()
    const controller = createKnowledgeResourceController(service)
    const response = makeResponse()

    await controller.listFolders(
      { user: { userId: 7, username: 'student', role: 'student' } } as never,
      response as never
    )

    expect(response.status).toHaveBeenCalledWith(200)
    expect(response.json).toHaveBeenCalledWith({
      code: 0,
      message: '获取资料文件夹成功',
      data: [{ id: 1, slug: 'builtin', name: '内置资料', isBuiltin: true }],
    })
  })

  it('maps a missing resource to an explicit 404 response', async () => {
    const service = makeService()
    ;(service.getResource as jest.Mock).mockRejectedValue(
      Object.assign(new Error('请求的资料不存在'), { code: 'NOT_FOUND', statusCode: 404 })
    )
    const controller = createKnowledgeResourceController(service)
    const response = makeResponse()

    await controller.getResource(
      {
        user: { userId: 7, username: 'student', role: 'student' },
        params: { id: '999' },
      } as never,
      response as never
    )

    expect(response.status).toHaveBeenCalledWith(404)
    expect(response.json).toHaveBeenCalledWith({
      code: 1004,
      message: '请求的资料不存在',
      data: null,
    })
  })

  it('passes an authenticated counselor file to the upload service', async () => {
    const service = makeService()
    const uploadService = makeUploadService()
    const controller = createKnowledgeResourceController(service, uploadService)
    const response = makeResponse()
    const file = {
      fieldname: 'file',
      originalname: 'exercise.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: 12,
      buffer: Buffer.from('%PDF-1.7\nbody'),
    }

    await controller.uploadResource(
      {
        user: { userId: 7, username: 'teacher', role: 'counselor' },
        body: { title: '压力管理练习', summary: '课堂练习资料', licenseCode: '' },
        file,
      } as never,
      response as never
    )

    expect(uploadService.upload).toHaveBeenCalledWith({
      userId: 7,
      role: 'counselor',
      title: '压力管理练习',
      summary: '课堂练习资料',
      licenseCode: '',
      file,
    })
    expect(response.status).toHaveBeenCalledWith(201)
  })

  it('returns a clear 400 response when no upload file is provided', async () => {
    const uploadService = makeUploadService()
    const controller = createKnowledgeResourceController(makeService(), uploadService)
    const response = makeResponse()

    await controller.uploadResource(
      {
        user: { userId: 7, username: 'teacher', role: 'counselor' },
        body: { title: '资料', summary: '简介' },
      } as never,
      response as never
    )

    expect(response.status).toHaveBeenCalledWith(400)
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: '请选择要上传的资料文件' })
    )
    expect(uploadService.upload).not.toHaveBeenCalled()
  })
})
