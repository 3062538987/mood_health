import { createMusic, getMusicList, updateMusic } from '../../../src/controllers/musicController'
import { createMusicRepository } from '../../../src/repositories/musicRepository'

jest.mock('../../../src/repositories/musicRepository', () => ({
  createMusicRepository: jest.fn(() => ({
    findAll: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  })),
}))

const repository = (createMusicRepository as jest.Mock).mock.results[0].value as {
  findAll: jest.Mock
  update: jest.Mock
  create: jest.Mock
}

const makeResponse = () => {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
  }
  response.status.mockReturnValue(response)
  response.json.mockReturnValue(response)
  return response
}

describe('musicController API contract', () => {
  beforeEach(() => {
    repository.findAll.mockReset()
    repository.update.mockReset()
    repository.create.mockReset()
  })

  it('returns the standard success envelope for the music list', async () => {
    const music = [{ id: 1, title: '白噪音', artist: 'Mood Health' }]
    repository.findAll.mockResolvedValue(music)
    const response = makeResponse()

    await getMusicList(
      { query: {} } as Parameters<typeof getMusicList>[0],
      response as unknown as Parameters<typeof getMusicList>[1]
    )

    expect(response.status).toHaveBeenCalledWith(200)
    expect(response.json).toHaveBeenCalledWith({
      code: 0,
      data: music,
      message: '获取音乐列表成功',
    })
  })

  it('returns the standard success envelope after updating music', async () => {
    const music = { id: 1, title: '新标题', artist: '新作者' }
    repository.update.mockResolvedValue(music)
    const response = makeResponse()

    await updateMusic(
      {
        params: { id: '1' },
        body: { title: '新标题', artist: '新作者' },
      } as unknown as Parameters<typeof updateMusic>[0],
      response as unknown as Parameters<typeof updateMusic>[1]
    )

    expect(response.json).toHaveBeenCalledWith({
      code: 0,
      data: music,
      message: '更新音乐成功',
    })
  })

  it('creates a complete music record for an administrator', async () => {
    const music = { id: 2, title: '森林呼吸', artist: 'Mood Health' }
    repository.create.mockResolvedValue(music)
    const response = makeResponse()

    await createMusic(
      {
        body: {
          title: ' 森林呼吸 ',
          artist: ' Mood Health ',
          url: 'https://example.com/forest.mp3',
          duration: '05:20',
          category: '自然声音',
          cover: '',
        },
      } as unknown as Parameters<typeof createMusic>[0],
      response as unknown as Parameters<typeof createMusic>[1]
    )

    expect(repository.create).toHaveBeenCalledWith({
      title: '森林呼吸',
      artist: 'Mood Health',
      url: 'https://example.com/forest.mp3',
      duration: '05:20',
      category: '自然声音',
      cover: null,
    })
    expect(response.status).toHaveBeenCalledWith(201)
  })

  it('rejects non-HTTPS media links instead of persisting unsafe URLs', async () => {
    const response = makeResponse()
    await createMusic(
      {
        body: {
          title: '不安全音乐',
          artist: '作者',
          url: 'javascript:alert(1)',
          duration: '03:00',
          category: '其他',
        },
      } as unknown as Parameters<typeof createMusic>[0],
      response as unknown as Parameters<typeof createMusic>[1]
    )

    expect(repository.create).not.toHaveBeenCalled()
    expect(response.status).toHaveBeenCalledWith(400)
  })
})
