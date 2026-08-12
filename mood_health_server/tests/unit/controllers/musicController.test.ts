import { getMusicList, updateMusic } from '../../../src/controllers/musicController'
import { createMusicRepository } from '../../../src/repositories/musicRepository'

jest.mock('../../../src/repositories/musicRepository', () => ({
  createMusicRepository: jest.fn(() => ({
    findAll: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
  })),
}))

const repository = (createMusicRepository as jest.Mock).mock.results[0].value as {
  findAll: jest.Mock
  update: jest.Mock
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
})
