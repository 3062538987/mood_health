import pool, { isSqliteClient } from '../config/database'
import sql from 'mssql'
import { sqliteAll, sqliteGet, sqliteRun } from '../config/sqlite'

export interface Course {
  id: number
  title: string
  description: string
  coverUrl: string
  content: string
  category: string
  studyCount: number
  type: 'video' | 'article'
  createdAt: Date
  updatedAt: Date
}

let courseSchemaChecked = false

const ensureCourseSchema = async () => {
  if (courseSchemaChecked) {
    return
  }

  if (isSqliteClient) {
    sqliteRun(`
      CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        coverUrl TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL,
        studyCount INTEGER DEFAULT 0,
        type TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)
    courseSchemaChecked = true
    return
  }

  courseSchemaChecked = true
}

export const getCourses = async (category?: string): Promise<Course[]> => {
  await ensureCourseSchema()

  if (isSqliteClient) {
    if (category) {
      return sqliteAll(
        'SELECT * FROM courses WHERE category = ? ORDER BY datetime(createdAt) DESC',
        [category]
      ) as unknown as Course[]
    }

    return sqliteAll(
      'SELECT * FROM courses ORDER BY datetime(createdAt) DESC'
    ) as unknown as Course[]
  }

  let query = 'SELECT * FROM courses'
  const params: any[] = []

  if (category) {
    query += ' WHERE category = @category'
    params.push({ name: 'category', value: category, type: sql.NVarChar })
  }

  query += ' ORDER BY createdAt DESC'

  const request = pool.request()
  params.forEach((param) => request.input(param.name, param.type, param.value))

  const result = await request.query(query)
  return result.recordset
}

export const getCourseById = async (id: number): Promise<Course | null> => {
  await ensureCourseSchema()

  if (isSqliteClient) {
    const row = sqliteGet('SELECT * FROM courses WHERE id = ?', [id]) as Course | undefined
    return row || null
  }

  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query('SELECT * FROM courses WHERE id = @id')

  return result.recordset.length ? result.recordset[0] : null
}

export const createCourse = async (
  course: Omit<Course, 'id' | 'studyCount' | 'createdAt' | 'updatedAt'>
): Promise<number> => {
  await ensureCourseSchema()

  const { title, description, coverUrl, content, category, type } = course

  if (isSqliteClient) {
    const result = sqliteRun(
      `
        INSERT INTO courses (title, description, coverUrl, content, category, type)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [title, description, coverUrl, content, category, type]
    )

    return Number(result.lastInsertRowid)
  }

  const result = await pool
    .request()
    .input('title', sql.NVarChar, title)
    .input('description', sql.NVarChar, description)
    .input('coverUrl', sql.NVarChar, coverUrl)
    .input('content', sql.NVarChar, content)
    .input('category', sql.NVarChar, category)
    .input('type', sql.NVarChar, type).query(`
      INSERT INTO courses (title, description, coverUrl, content, category, type)
      OUTPUT INSERTED.id
      VALUES (@title, @description, @coverUrl, @content, @category, @type)
    `)

  return result.recordset[0].id
}

export const updateCourse = async (
  id: number,
  course: Partial<Omit<Course, 'id' | 'studyCount' | 'createdAt' | 'updatedAt'>>
): Promise<boolean> => {
  await ensureCourseSchema()

  if (isSqliteClient) {
    const setClauses: string[] = []
    const params: unknown[] = []

    if (course.title !== undefined) {
      setClauses.push('title = ?')
      params.push(course.title)
    }
    if (course.description !== undefined) {
      setClauses.push('description = ?')
      params.push(course.description)
    }
    if (course.coverUrl !== undefined) {
      setClauses.push('coverUrl = ?')
      params.push(course.coverUrl)
    }
    if (course.content !== undefined) {
      setClauses.push('content = ?')
      params.push(course.content)
    }
    if (course.category !== undefined) {
      setClauses.push('category = ?')
      params.push(course.category)
    }
    if (course.type !== undefined) {
      setClauses.push('type = ?')
      params.push(course.type)
    }

    setClauses.push("updatedAt = datetime('now', 'localtime')")

    if (setClauses.length === 1) {
      return false
    }

    const result = sqliteRun(`UPDATE courses SET ${setClauses.join(', ')} WHERE id = ?`, [
      ...params,
      id,
    ])
    return Number(result.changes || 0) > 0
  }

  const setClauses: string[] = []
  const params: any[] = []

  if (course.title !== undefined) {
    setClauses.push('title = @title')
    params.push({ name: 'title', value: course.title, type: sql.NVarChar })
  }
  if (course.description !== undefined) {
    setClauses.push('description = @description')
    params.push({
      name: 'description',
      value: course.description,
      type: sql.NVarChar,
    })
  }
  if (course.coverUrl !== undefined) {
    setClauses.push('coverUrl = @coverUrl')
    params.push({
      name: 'coverUrl',
      value: course.coverUrl,
      type: sql.NVarChar,
    })
  }
  if (course.content !== undefined) {
    setClauses.push('content = @content')
    params.push({ name: 'content', value: course.content, type: sql.NVarChar })
  }
  if (course.category !== undefined) {
    setClauses.push('category = @category')
    params.push({
      name: 'category',
      value: course.category,
      type: sql.NVarChar,
    })
  }
  if (course.type !== undefined) {
    setClauses.push('type = @type')
    params.push({ name: 'type', value: course.type, type: sql.NVarChar })
  }

  setClauses.push('updatedAt = GETDATE()')

  if (setClauses.length === 0) {
    return false
  }

  const query = `UPDATE courses SET ${setClauses.join(', ')} WHERE id = @id`

  const request = pool.request()
  params.forEach((param) => request.input(param.name, param.type, param.value))
  request.input('id', sql.Int, id)

  const result = await request.query(query)
  return result.rowsAffected[0] > 0
}

export const deleteCourse = async (id: number): Promise<boolean> => {
  await ensureCourseSchema()

  if (isSqliteClient) {
    const result = sqliteRun('DELETE FROM courses WHERE id = ?', [id])
    return Number(result.changes || 0) > 0
  }

  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query('DELETE FROM courses WHERE id = @id')

  return result.rowsAffected[0] > 0
}

export const incrementStudyCount = async (id: number): Promise<boolean> => {
  await ensureCourseSchema()

  if (isSqliteClient) {
    const result = sqliteRun('UPDATE courses SET studyCount = studyCount + 1 WHERE id = ?', [id])
    return Number(result.changes || 0) > 0
  }

  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query('UPDATE courses SET studyCount = studyCount + 1 WHERE id = @id')

  return result.rowsAffected[0] > 0
}
