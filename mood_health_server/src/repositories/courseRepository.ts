import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getMysqlPool } from '../config/mysql'

export interface CourseDatabase {
  query<T>(sql: string, params?: unknown[]): Promise<[T, unknown]>
}

export interface CourseDto {
  id: number
  title: string
  description: string
  coverUrl: string
  content: string
  category: string
  studyCount: number
  type: 'video' | 'article'
  createdAt: string
  updatedAt: string
}

export interface CreateCourseInput {
  title: string
  description: string
  coverUrl: string
  content: string
  category: string
  type: 'video' | 'article'
}

type CourseRow = RowDataPacket & {
  id: number
  title: string
  description: string
  cover_url: string
  content: string
  category: string
  study_count: number
  type: string
  created_at: Date | string
  updated_at: Date | string
}

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : String(value)

const mapCourse = (row: CourseRow): CourseDto => ({
  id: row.id,
  title: row.title,
  description: row.description,
  coverUrl: row.cover_url,
  content: row.content,
  category: row.category,
  studyCount: row.study_count,
  type: row.type as 'video' | 'article',
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
})

export const createCourseRepository = (db: CourseDatabase = getMysqlPool()) => {
  const findAll = async (category?: string): Promise<CourseDto[]> => {
    const params: unknown[] = []
    let sql = 'SELECT * FROM courses'
    if (category) {
      sql += ' WHERE category = ?'
      params.push(category)
    }
    sql += ' ORDER BY created_at DESC'
    const [rows] = await db.query<CourseRow[]>(sql, params)
    return rows.map(mapCourse)
  }

  const findById = async (id: number): Promise<CourseDto | null> => {
    const [rows] = await db.query<CourseRow[]>(
      'SELECT * FROM courses WHERE id = ? LIMIT 1',
      [id]
    )
    return rows[0] ? mapCourse(rows[0]) : null
  }

  const create = async (input: CreateCourseInput): Promise<CourseDto> => {
    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO courses (title, description, cover_url, content, category, type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [input.title, input.description, input.coverUrl, input.content, input.category, input.type]
    )
    return findById(result.insertId) as Promise<CourseDto>
  }

  const update = async (id: number, input: Partial<CreateCourseInput>): Promise<CourseDto | null> => {
    const [existing] = await db.query<CourseRow[]>(
      'SELECT * FROM courses WHERE id = ? LIMIT 1',
      [id]
    )
    if (!existing[0]) return null

    const merged = {
      title: input.title ?? existing[0].title,
      description: input.description ?? existing[0].description,
      coverUrl: input.coverUrl ?? existing[0].cover_url,
      content: input.content ?? existing[0].content,
      category: input.category ?? existing[0].category,
      type: input.type ?? existing[0].type,
    }

    await db.query<ResultSetHeader>(
      `UPDATE courses SET title = ?, description = ?, cover_url = ?, content = ?, category = ?, type = ?
       WHERE id = ?`,
      [merged.title, merged.description, merged.coverUrl, merged.content, merged.category, merged.type, id]
    )
    return findById(id)
  }

  const remove = async (id: number): Promise<boolean> => {
    const [result] = await db.query<ResultSetHeader>(
      'DELETE FROM courses WHERE id = ?',
      [id]
    )
    return result.affectedRows > 0
  }

  const incrementStudyCount = async (id: number): Promise<boolean> => {
    const [result] = await db.query<ResultSetHeader>(
      'UPDATE courses SET study_count = study_count + 1 WHERE id = ?',
      [id]
    )
    return result.affectedRows > 0
  }

  return { findAll, findById, create, update, remove, incrementStudyCount }
}

export type CourseRepository = ReturnType<typeof createCourseRepository>