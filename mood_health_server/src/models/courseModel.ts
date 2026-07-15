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

const ensureCourseSchema = () => {
  if (courseSchemaChecked) return
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
}

export const getCourses = async (category?: string): Promise<Course[]> => {
  ensureCourseSchema()
  return (category
    ? sqliteAll('SELECT * FROM courses WHERE category = ? ORDER BY datetime(createdAt) DESC', [
        category,
      ])
    : sqliteAll('SELECT * FROM courses ORDER BY datetime(createdAt) DESC')) as unknown as Course[]
}

export const getCourseById = async (id: number): Promise<Course | null> => {
  ensureCourseSchema()
  const row = sqliteGet('SELECT * FROM courses WHERE id = ?', [id]) as Course | undefined
  return row || null
}

export const createCourse = async (
  course: Omit<Course, 'id' | 'studyCount' | 'createdAt' | 'updatedAt'>
): Promise<number> => {
  ensureCourseSchema()
  const result = sqliteRun(
    `INSERT INTO courses (title, description, coverUrl, content, category, type)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [course.title, course.description, course.coverUrl, course.content, course.category, course.type]
  )
  return Number(result.lastInsertRowid)
}

export const updateCourse = async (
  id: number,
  course: Partial<Omit<Course, 'id' | 'studyCount' | 'createdAt' | 'updatedAt'>>
): Promise<boolean> => {
  ensureCourseSchema()
  const clauses: string[] = []
  const params: unknown[] = []
  const fields = ['title', 'description', 'coverUrl', 'content', 'category', 'type'] as const

  for (const field of fields) {
    if (course[field] !== undefined) {
      clauses.push(`${field} = ?`)
      params.push(course[field])
    }
  }
  if (!clauses.length) return false
  clauses.push("updatedAt = datetime('now', 'localtime')")
  const result = sqliteRun(`UPDATE courses SET ${clauses.join(', ')} WHERE id = ?`, [
    ...params,
    id,
  ])
  return result.changes > 0
}

export const deleteCourse = async (id: number): Promise<boolean> => {
  ensureCourseSchema()
  return sqliteRun('DELETE FROM courses WHERE id = ?', [id]).changes > 0
}

export const incrementStudyCount = async (id: number): Promise<boolean> => {
  ensureCourseSchema()
  return sqliteRun('UPDATE courses SET studyCount = studyCount + 1 WHERE id = ?', [id]).changes > 0
}
