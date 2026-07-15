import { sqliteAll, sqliteGet, sqliteRun } from '../config/sqlite'

export interface Music {
  id: number
  title: string
  artist: string
  url: string
  duration: string
  category: string
  cover: string
  created_at: Date
  updated_at: Date
}

let musicSchemaChecked = false

const ensureMusicSchema = () => {
  if (musicSchemaChecked) return
  sqliteRun(`
    CREATE TABLE IF NOT EXISTS musics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      url TEXT NOT NULL,
      duration TEXT NOT NULL,
      category TEXT NOT NULL,
      cover TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)
  musicSchemaChecked = true
}

export const getMusicList = async (category?: string): Promise<Music[]> => {
  ensureMusicSchema()
  return (category
    ? sqliteAll('SELECT * FROM musics WHERE category = ? ORDER BY datetime(created_at) DESC', [
        category,
      ])
    : sqliteAll('SELECT * FROM musics ORDER BY datetime(created_at) DESC')) as unknown as Music[]
}

export const getMusicById = async (id: number): Promise<Music | null> => {
  ensureMusicSchema()
  return (sqliteGet('SELECT * FROM musics WHERE id = ?', [id]) as Music | undefined) || null
}

export const createMusic = async (
  music: Partial<Omit<Music, 'id' | 'created_at' | 'updated_at'>>
): Promise<Music> => {
  ensureMusicSchema()
  const result = sqliteRun(
    'INSERT INTO musics (title, artist, url, duration, category, cover) VALUES (?, ?, ?, ?, ?, ?)',
    [music.title, music.artist, music.url, music.duration, music.category, music.cover || null]
  )
  return sqliteGet('SELECT * FROM musics WHERE id = ?', [
    Number(result.lastInsertRowid),
  ]) as unknown as Music
}

export const updateMusic = async (
  id: number,
  music: Partial<Omit<Music, 'id' | 'created_at' | 'updated_at'>>
): Promise<Music | null> => {
  ensureMusicSchema()
  const result = sqliteRun(
    `
      UPDATE musics
      SET title = ?, artist = ?, url = ?, duration = ?, category = ?, cover = ?,
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `,
    [music.title, music.artist, music.url, music.duration, music.category, music.cover || null, id]
  )
  return result.changes === 0
    ? null
    : ((sqliteGet('SELECT * FROM musics WHERE id = ?', [id]) as Music | undefined) || null)
}

export const deleteMusic = async (id: number): Promise<boolean> => {
  ensureMusicSchema()
  return sqliteRun('DELETE FROM musics WHERE id = ?', [id]).changes > 0
}
