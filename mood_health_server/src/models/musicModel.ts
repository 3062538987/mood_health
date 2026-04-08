import pool, { isSqliteClient } from '../config/database'
import sql from 'mssql'
import { sqliteAll, sqliteGet, sqliteRun } from '../config/sqlite'

/**
 * 音乐模型接口
 * @interface Music
 * @property {number} id - 音乐ID
 * @property {string} title - 音乐标题
 * @property {string} artist - 艺术家
 * @property {string} url - 音乐URL
 * @property {string} duration - 音乐时长
 * @property {string} category - 音乐分类
 * @property {string} cover - 封面图片URL
 * @property {Date} created_at - 创建时间
 * @property {Date} updated_at - 更新时间
 */
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

const ensureMusicSchema = async () => {
  if (musicSchemaChecked) {
    return
  }

  if (isSqliteClient) {
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
    return
  }

  musicSchemaChecked = true
}

/**
 * 获取音乐列表
 * @param {string} [category] - 音乐分类（可选）
 * @returns {Promise<Music[]>} - 音乐列表
 */
export const getMusicList = async (category?: string): Promise<Music[]> => {
  await ensureMusicSchema()

  if (isSqliteClient) {
    if (category) {
      return sqliteAll(
        'SELECT * FROM musics WHERE category = ? ORDER BY datetime(created_at) DESC',
        [category]
      ) as unknown as Music[]
    }

    return sqliteAll(
      'SELECT * FROM musics ORDER BY datetime(created_at) DESC'
    ) as unknown as Music[]
  }

  let query = 'SELECT * FROM musics'
  const params: any[] = []

  if (category) {
    query += ' WHERE category = @category'
    params.push({ name: 'category', type: sql.NVarChar, value: category })
  }

  const result = await pool.request().input('category', sql.NVarChar, category).query(query)

  return result.recordset
}

/**
 * 根据ID获取音乐
 * @param {number} id - 音乐ID
 * @returns {Promise<Music | null>} - 音乐对象或null
 */
export const getMusicById = async (id: number): Promise<Music | null> => {
  await ensureMusicSchema()

  if (isSqliteClient) {
    const row = sqliteGet('SELECT * FROM musics WHERE id = ?', [id]) as Music | undefined
    return row || null
  }

  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query('SELECT * FROM musics WHERE id = @id')

  return result.recordset.length ? result.recordset[0] : null
}

/**
 * 创建音乐
 * @param {Omit<Music, "id" | "created_at" | "updated_at">} musicData - 音乐数据
 * @returns {Promise<Music>} - 创建的音乐对象
 */
export const createMusic = async (
  musicData: Partial<Omit<Music, 'id' | 'created_at' | 'updated_at'>>
): Promise<Music> => {
  await ensureMusicSchema()

  const { title, artist, url, duration, category, cover } = musicData

  if (isSqliteClient) {
    const insertResult = sqliteRun(
      `
        INSERT INTO musics (title, artist, url, duration, category, cover)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [title, artist, url, duration, category, cover || null]
    )

    return sqliteGet('SELECT * FROM musics WHERE id = ?', [
      Number(insertResult.lastInsertRowid),
    ]) as unknown as Music
  }

  const result = await pool
    .request()
    .input('title', sql.NVarChar, title)
    .input('artist', sql.NVarChar, artist)
    .input('url', sql.NVarChar, url)
    .input('duration', sql.NVarChar, duration)
    .input('category', sql.NVarChar, category)
    .input('cover', sql.NVarChar, cover).query(`
      INSERT INTO musics (title, artist, url, duration, category, cover)
      VALUES (@title, @artist, @url, @duration, @category, @cover)
      OUTPUT INSERTED.*
    `)

  return result.recordset[0]
}

/**
 * 更新音乐
 * @param {number} id - 音乐ID
 * @param {Partial<Omit<Music, "id" | "created_at" | "updated_at">>} musicData - 音乐数据
 * @returns {Promise<Music | null>} - 更新后的音乐对象或null
 */
export const updateMusic = async (
  id: number,
  musicData: Partial<Omit<Music, 'id' | 'created_at' | 'updated_at'>>
): Promise<Music | null> => {
  await ensureMusicSchema()

  const { title, artist, url, duration, category, cover } = musicData

  if (isSqliteClient) {
    const result = sqliteRun(
      `
        UPDATE musics
        SET title = ?,
            artist = ?,
            url = ?,
            duration = ?,
            category = ?,
            cover = ?,
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `,
      [title, artist, url, duration, category, cover || null, id]
    )

    if (Number(result.changes || 0) === 0) {
      return null
    }

    return (sqliteGet('SELECT * FROM musics WHERE id = ?', [id]) as unknown as Music) || null
  }

  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .input('title', sql.NVarChar, title)
    .input('artist', sql.NVarChar, artist)
    .input('url', sql.NVarChar, url)
    .input('duration', sql.NVarChar, duration)
    .input('category', sql.NVarChar, category)
    .input('cover', sql.NVarChar, cover).query(`
      UPDATE musics
      SET title = @title, artist = @artist, url = @url, duration = @duration, category = @category, cover = @cover
      WHERE id = @id
      OUTPUT INSERTED.*
    `)

  return result.recordset.length ? result.recordset[0] : null
}

/**
 * 删除音乐
 * @param {number} id - 音乐ID
 * @returns {Promise<boolean>} - 是否删除成功
 */
export const deleteMusic = async (id: number): Promise<boolean> => {
  await ensureMusicSchema()

  if (isSqliteClient) {
    const result = sqliteRun('DELETE FROM musics WHERE id = ?', [id])
    return Number(result.changes || 0) > 0
  }

  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query('DELETE FROM musics WHERE id = @id')

  return result.rowsAffected[0] > 0
}
