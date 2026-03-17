import sql from "mssql";
import pool from "../config/database";
import logger from "../utils/logger";

export interface RelaxRecordInput {
  activityType: string;
  startTime: string;
  endTime: string;
  metrics?: Record<string, unknown>;
  moodTag?: string;
}

export interface RelaxRecordEntity {
  id: string;
  userId: string;
  activityType: string;
  startTime: string;
  endTime: string;
  metrics: Record<string, unknown>;
  moodTag?: string;
}

export interface RelaxStatisticsEntity {
  todayDuration: number;
  thisWeekCount: number;
  mostUsedActivity: string;
  activityBreakdown: Array<{
    type: string;
    count: number;
    duration: number;
  }>;
}

let relaxSchemaChecked = false;

const parseMetrics = (raw: unknown): Record<string, unknown> => {
  if (!raw) {
    return {};
  }
  if (typeof raw === "object") {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
};

const mapRecord = (row: Record<string, unknown>): RelaxRecordEntity => ({
  id: String(row.id),
  userId: String(row.userId),
  activityType: String(row.activityType),
  startTime: new Date(String(row.startTime)).toISOString(),
  endTime: new Date(String(row.endTime)).toISOString(),
  metrics: parseMetrics(row.metrics),
  moodTag: row.moodTag ? String(row.moodTag) : undefined,
});

const ensureRelaxSchema = async () => {
  if (relaxSchemaChecked) {
    return;
  }

  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'relax_records')
    BEGIN
      CREATE TABLE relax_records (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        activity_type NVARCHAR(50) NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        metrics NVARCHAR(MAX) NULL,
        mood_tag NVARCHAR(50) NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      CREATE INDEX idx_relax_records_user_id ON relax_records(user_id);
      CREATE INDEX idx_relax_records_start_time ON relax_records(start_time DESC);
    END
  `);

  relaxSchemaChecked = true;
};

export const saveRelaxRecord = async (
  userId: number,
  record: RelaxRecordInput,
): Promise<RelaxRecordEntity> => {
  await ensureRelaxSchema();

  const result = await pool
    .request()
    .input("userId", sql.Int, userId)
    .input("activityType", sql.NVarChar, record.activityType)
    .input("startTime", sql.DateTime, new Date(record.startTime))
    .input("endTime", sql.DateTime, new Date(record.endTime))
    .input("metrics", sql.NVarChar, JSON.stringify(record.metrics || {}))
    .input("moodTag", sql.NVarChar, record.moodTag || null).query(`
      INSERT INTO relax_records (user_id, activity_type, start_time, end_time, metrics, mood_tag)
      OUTPUT INSERTED.id,
             INSERTED.user_id AS userId,
             INSERTED.activity_type AS activityType,
             INSERTED.start_time AS startTime,
             INSERTED.end_time AS endTime,
             INSERTED.metrics AS metrics,
             INSERTED.mood_tag AS moodTag
      VALUES (@userId, @activityType, @startTime, @endTime, @metrics, @moodTag)
    `);

  return mapRecord(result.recordset[0]);
};

export const getRelaxRecords = async (
  userId: number,
  params: {
    startDate?: string;
    endDate?: string;
    activityType?: string;
    page?: number;
    pageSize?: number;
  },
): Promise<{ records: RelaxRecordEntity[]; total: number }> => {
  await ensureRelaxSchema();

  const safePage = params.page && params.page > 0 ? Math.floor(params.page) : 1;
  const safePageSize =
    params.pageSize && params.pageSize > 0
      ? Math.min(Math.floor(params.pageSize), 100)
      : 20;
  const offset = (safePage - 1) * safePageSize;

  const filters: string[] = ["user_id = @userId"];
  const countRequest = pool.request().input("userId", sql.Int, userId);
  const listRequest = pool.request().input("userId", sql.Int, userId);

  if (params.startDate) {
    filters.push("start_time >= @startDate");
    countRequest.input("startDate", sql.DateTime, new Date(params.startDate));
    listRequest.input("startDate", sql.DateTime, new Date(params.startDate));
  }

  if (params.endDate) {
    filters.push("start_time <= @endDate");
    countRequest.input("endDate", sql.DateTime, new Date(params.endDate));
    listRequest.input("endDate", sql.DateTime, new Date(params.endDate));
  }

  if (params.activityType) {
    filters.push("activity_type = @activityType");
    countRequest.input("activityType", sql.NVarChar, params.activityType);
    listRequest.input("activityType", sql.NVarChar, params.activityType);
  }

  const whereClause = filters.join(" AND ");
  const countResult = await countRequest.query(`
    SELECT COUNT(*) AS total
    FROM relax_records
    WHERE ${whereClause}
  `);

  const listResult = await listRequest
    .input("offset", sql.Int, offset)
    .input("pageSize", sql.Int, safePageSize).query(`
      SELECT id,
             user_id AS userId,
             activity_type AS activityType,
             start_time AS startTime,
             end_time AS endTime,
             metrics,
             mood_tag AS moodTag
      FROM relax_records
      WHERE ${whereClause}
      ORDER BY start_time DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `);

  return {
    records: listResult.recordset.map((row: Record<string, unknown>) =>
      mapRecord(row),
    ),
    total: countResult.recordset[0]?.total || 0,
  };
};

export const getRelaxRecordById = async (
  userId: number,
  id: number,
): Promise<RelaxRecordEntity | null> => {
  await ensureRelaxSchema();

  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .input("userId", sql.Int, userId).query(`
      SELECT id,
             user_id AS userId,
             activity_type AS activityType,
             start_time AS startTime,
             end_time AS endTime,
             metrics,
             mood_tag AS moodTag
      FROM relax_records
      WHERE id = @id AND user_id = @userId
    `);

  return result.recordset[0] ? mapRecord(result.recordset[0]) : null;
};

export const getRelaxStatistics = async (
  userId: number,
  params: { startDate?: string; endDate?: string },
): Promise<RelaxStatisticsEntity> => {
  await ensureRelaxSchema();

  const recordsResult = await getRelaxRecords(userId, {
    ...params,
    page: 1,
    pageSize: 500,
  });
  const records = recordsResult.records;
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const activityMap = new Map<string, { count: number; duration: number }>();
  let todayDuration = 0;
  let thisWeekCount = 0;

  for (const record of records) {
    const start = new Date(record.startTime).getTime();
    const end = new Date(record.endTime).getTime();
    const duration = Math.max(0, end - start);
    const item = activityMap.get(record.activityType) || {
      count: 0,
      duration: 0,
    };
    item.count += 1;
    item.duration += duration;
    activityMap.set(record.activityType, item);

    if (record.startTime.slice(0, 10) === today) {
      todayDuration += duration;
    }
    if (new Date(record.startTime) >= weekAgo) {
      thisWeekCount += 1;
    }
  }

  let mostUsedActivity = "";
  let maxCount = 0;
  const activityBreakdown = Array.from(activityMap.entries()).map(
    ([type, value]) => {
      if (value.count > maxCount) {
        maxCount = value.count;
        mostUsedActivity = type;
      }
      return {
        type,
        count: value.count,
        duration: value.duration,
      };
    },
  );

  return {
    todayDuration,
    thisWeekCount,
    mostUsedActivity,
    activityBreakdown,
  };
};

export const logRelaxError = (
  message: string,
  error: unknown,
  extra?: Record<string, unknown>,
) => {
  logger.error(message, {
    ...extra,
    error,
  });
};
