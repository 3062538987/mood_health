import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getMysqlPool } from '../config/mysql'

export interface MusicDatabase {
  query<T>(sql: string, params?: unknown[]): Promise<[T, unknown]>
}

export interface MusicDto {
  id: number
  title: string
  artist: string
  url: string
  duration: string
  category: string
  cover: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateMusicInput {
  title: string
  artist: string
  url: string
  duration: string
  category: string
  cover?: string | null
}

type MusicRow = RowDataPacket & {
  id: number
  title: string
  artist: string
  url: string
  duration: string
  category: string
  cover: string | null
  created_at: Date | string
  updated_at: Date | string
}

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : String(value)

const mapMusic = (row: MusicRow): MusicDto => ({
  id: row.id,
  title: row.title,
  artist: row.artist,
  url: row.url,
  duration: row.duration,
  category: row.category,
  cover: row.cover,
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
})

export const createMusicRepository = (db: MusicDatabase = getMysqlPool()) => {
  const findAll = async (category?: string): Promise<MusicDto[]> => {
    const params: unknown[] = []
    let sql = 'SELECT * FROM musics'
    if (category) {
      sql += ' WHERE category = ?'
      params.push(category)
    }
    sql += ' ORDER BY created_at DESC'
    const [rows] = await db.query<MusicRow[]>(sql, params)
    return rows.map(mapMusic)
  }

  const findById = async (id: number): Promise<MusicDto | null> => {
    const [rows] = await db.query<MusicRow[]>(
      'SELECT * FROM musics WHERE id = ? LIMIT 1',
      [id]
    )
    return rows[0] ? mapMusic(rows[0]) : null
  }

  const create = async (input: CreateMusicInput): Promise<MusicDto> => {
    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO musics (title, artist, url, duration, category, cover)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [input.title, input.artist, input.url, input.duration, input.category, input.cover ?? null]
    )
    return findById(result.insertId) as Promise<MusicDto>
  }

  const update = async (id: number, input: Partial<CreateMusicInput>): Promise<MusicDto | null> => {
    const [existing] = await db.query<MusicRow[]>(
      'SELECT * FROM musics WHERE id = ? LIMIT 1',
      [id]
    )
    if (!existing[0]) return null

    const merged = {
      title: input.title ?? existing[0].title,
      artist: input.artist ?? existing[0].artist,
      url: input.url ?? existing[0].url,
      duration: input.duration ?? existing[0].duration,
      category: input.category ?? existing[0].category,
      cover: input.cover !== undefined ? input.cover : existing[0].cover,
    }

    await db.query<ResultSetHeader>(
      `UPDATE musics SET title = ?, artist = ?, url = ?, duration = ?, category = ?, cover = ?
       WHERE id = ?`,
      [merged.title, merged.artist, merged.url, merged.duration, merged.category, merged.cover, id]
    )
    return findById(id)
  }

  const remove = async (id: number): Promise<boolean> => {
    const [result] = await db.query<ResultSetHeader>(
      'DELETE FROM musics WHERE id = ?',
      [id]
    )
    return result.affectedRows > 0
  }

  return { findAll, findById, create, update, remove }
}

export type MusicRepository = ReturnType<typeof createMusicRepository>