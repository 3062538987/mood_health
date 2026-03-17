import sql from "mssql";
import pool from "../config/database";
import logger from "../utils/logger";

export interface AdviceHistory {
  id: number;
  userId: number;
  moodRecordId?: number;
  analysis: string;
  suggestions: string[];
  createdAt: Date;
}

let tableChecked = false;

const ensureAdviceHistoryTable = async (): Promise<void> => {
  if (tableChecked) {
    return;
  }

  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.objects
      WHERE object_id = OBJECT_ID(N'[dbo].[advice_history]') AND type = N'U'
    )
    BEGIN
      CREATE TABLE advice_history (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        mood_record_id INT NULL,
        analysis NVARCHAR(1000) NOT NULL,
        suggestions NVARCHAR(MAX) NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (mood_record_id) REFERENCES moods(id) ON DELETE SET NULL
      );
      CREATE INDEX idx_advice_history_user_id ON advice_history(user_id);
      CREATE INDEX idx_advice_history_created_at ON advice_history(created_at DESC);
    END
  `);

  tableChecked = true;
};

const getDbErrorMessage = (error: unknown): string => {
  const err = error as {
    message?: string;
    originalError?: { info?: { message?: string } };
  };
  return err?.originalError?.info?.message || err?.message || "数据库访问失败";
};

const normalizeSuggestions = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item)).filter(Boolean);
  }

  if (typeof raw !== "string") {
    return [];
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item)).filter(Boolean);
    }
  } catch (error) {
    // 兼容历史脏数据：把非 JSON 文本回退为单条建议，避免整页 500。
  }

  return [trimmed];
};

export const createAdviceHistory = async (
  userId: number,
  moodRecordId: number | undefined,
  analysis: string,
  suggestions: string[],
): Promise<number> => {
  try {
    await ensureAdviceHistoryTable();
    const suggestionsStr = JSON.stringify(
      suggestions.filter(
        (item) => typeof item === "string" && item.trim().length > 0,
      ),
    );
    const safeAnalysis = analysis.trim().slice(0, 1000);

    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("moodRecordId", sql.Int, moodRecordId || null)
      .input("analysis", sql.NVarChar, safeAnalysis)
      .input("suggestions", sql.NVarChar, suggestionsStr).query(`
        INSERT INTO advice_history (user_id, mood_record_id, analysis, suggestions)
        VALUES (@userId, @moodRecordId, @analysis, @suggestions);
        SELECT SCOPE_IDENTITY() as id;
      `);

    return result.recordset[0].id;
  } catch (error) {
    logger.error("保存 AI 建议历史失败", {
      userId,
      moodRecordId,
      dbMessage: getDbErrorMessage(error),
      error,
    });
    throw error;
  }
};

export const getAdviceHistoryByUser = async (
  userId: number,
  page: number = 1,
  pageSize: number = 20,
): Promise<{ list: AdviceHistory[]; total: number }> => {
  try {
    await ensureAdviceHistoryTable();
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safePageSize =
      Number.isFinite(pageSize) && pageSize > 0
        ? Math.min(Math.floor(pageSize), 100)
        : 20;
    const offset = (safePage - 1) * safePageSize;

    const countResult = await pool.request().input("userId", sql.Int, userId)
      .query(`
        SELECT COUNT(*) as total
        FROM advice_history
        WHERE user_id = @userId
      `);

    const total = countResult.recordset[0].total;

    const listResult = await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("pageSize", sql.Int, safePageSize)
      .input("offset", sql.Int, offset).query(`
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
        suggestions: normalizeSuggestions(row.suggestions),
      })),
      total,
    };
  } catch (error) {
    logger.error("查询 AI 建议历史失败", {
      userId,
      page,
      pageSize,
      dbMessage: getDbErrorMessage(error),
      error,
    });
    throw error;
  }
};
