import pool from "../config/database";
import sql from "mssql";

export interface Course {
  id: number;
  title: string;
  description: string;
  coverUrl: string;
  content: string;
  category: string;
  studyCount: number;
  type: "video" | "article";
  createdAt: Date;
  updatedAt: Date;
}

export const getCourses = async (category?: string): Promise<Course[]> => {
  let query = "SELECT * FROM courses";
  const params: any[] = [];

  if (category) {
    query += " WHERE category = @category";
    params.push({ name: "category", value: category, type: sql.NVarChar });
  }

  query += " ORDER BY createdAt DESC";

  const request = pool.request();
  params.forEach((param) => request.input(param.name, param.type, param.value));

  const result = await request.query(query);
  return result.recordset;
};

export const getCourseById = async (id: number): Promise<Course | null> => {
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query("SELECT * FROM courses WHERE id = @id");

  return result.recordset.length ? result.recordset[0] : null;
};

export const createCourse = async (
  course: Omit<Course, "id" | "studyCount" | "createdAt" | "updatedAt">,
): Promise<number> => {
  const { title, description, coverUrl, content, category, type } = course;

  const result = await pool
    .request()
    .input("title", sql.NVarChar, title)
    .input("description", sql.NVarChar, description)
    .input("coverUrl", sql.NVarChar, coverUrl)
    .input("content", sql.NVarChar, content)
    .input("category", sql.NVarChar, category)
    .input("type", sql.NVarChar, type).query(`
      INSERT INTO courses (title, description, coverUrl, content, category, type)
      OUTPUT INSERTED.id
      VALUES (@title, @description, @coverUrl, @content, @category, @type)
    `);

  return result.recordset[0].id;
};

export const updateCourse = async (
  id: number,
  course: Partial<
    Omit<Course, "id" | "studyCount" | "createdAt" | "updatedAt">
  >,
): Promise<boolean> => {
  const setClauses: string[] = [];
  const params: any[] = [];

  if (course.title !== undefined) {
    setClauses.push("title = @title");
    params.push({ name: "title", value: course.title, type: sql.NVarChar });
  }
  if (course.description !== undefined) {
    setClauses.push("description = @description");
    params.push({
      name: "description",
      value: course.description,
      type: sql.NVarChar,
    });
  }
  if (course.coverUrl !== undefined) {
    setClauses.push("coverUrl = @coverUrl");
    params.push({
      name: "coverUrl",
      value: course.coverUrl,
      type: sql.NVarChar,
    });
  }
  if (course.content !== undefined) {
    setClauses.push("content = @content");
    params.push({ name: "content", value: course.content, type: sql.NVarChar });
  }
  if (course.category !== undefined) {
    setClauses.push("category = @category");
    params.push({
      name: "category",
      value: course.category,
      type: sql.NVarChar,
    });
  }
  if (course.type !== undefined) {
    setClauses.push("type = @type");
    params.push({ name: "type", value: course.type, type: sql.NVarChar });
  }

  setClauses.push("updatedAt = GETDATE()");

  if (setClauses.length === 0) {
    return false;
  }

  const query = `UPDATE courses SET ${setClauses.join(", ")} WHERE id = @id`;

  const request = pool.request();
  params.forEach((param) => request.input(param.name, param.type, param.value));
  request.input("id", sql.Int, id);

  const result = await request.query(query);
  return result.rowsAffected[0] > 0;
};

export const deleteCourse = async (id: number): Promise<boolean> => {
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query("DELETE FROM courses WHERE id = @id");

  return result.rowsAffected[0] > 0;
};

export const incrementStudyCount = async (id: number): Promise<boolean> => {
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query("UPDATE courses SET studyCount = studyCount + 1 WHERE id = @id");

  return result.rowsAffected[0] > 0;
};
