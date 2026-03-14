import sql from "mssql";
import pool from "../config/database";

export interface AdviceHistory {
  id: number;
  userId: number;
  moodRecordId?: number;
  analysis: string;
  suggestions: string;
  createdAt: Date;
}

export const createAdviceHistory = async (
  userId: number,
  moodRecordId: number | undefined,
  analysis: string,
  suggestions: string[],
): Promise<number> => {
  const suggestionsStr = JSON.stringify(suggestions);
  const result = await pool
    .request()
    .input("userId", sql.Int, userId)
    .input("moodRecordId", sql.Int, moodRecordId || null)
    .input("analysis", sql.NVarChar, analysis)
    .input("suggestions", sql.NVarChar, suggestionsStr)
    .query(`
      INSERT INTO advice_history (user_id, mood_record_id, analysis, suggestions)
      VALUES (@userId, @moodRecordId, @analysis, @suggestions);
      SELECT SCOPE_IDENTITY() as id;
    `);

  return result.recordset[0].id;
};

export const getAdviceHistoryByUser = async (
  userId: number,
  page: number = 1,
  pageSize: number = 20,
): Promise<{ list: AdviceHistory[]; total: number }> => {
  const offset = (page - 1) * pageSize;

  const countResult = await pool
    .request()
    .input("userId", sql.Int, userId)
    .query(`
      SELECT COUNT(*) as total
      FROM advice_history
      WHERE user_id = @userId
    `);

  const total = countResult.recordset[0].total;

  const listResult = await pool
    .request()
    .input("userId", sql.Int, userId)
    .input("pageSize", sql.Int, pageSize)
    .input("offset", sql.Int, offset)
    .query(`
      SELECT id, user_id as userId, mood_record_id as moodRecordId,
             analysis, suggestions, created_at as createdAt
      FROM advice_history
      WHERE user_id = @userId
      ORDER BY created_at DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `);

  return {
    list: listResult.recordset.map((row: any) => ({
      ...row,
      suggestions: JSON.parse(row.suggestions),
    })),
    total,
  };
};
