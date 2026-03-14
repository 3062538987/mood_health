import pool from "../config/database";
import sql from "mssql";

export interface Activity {
  id: number;
  title: string;
  description: string;
  start_time: Date;
  end_time: Date;
  max_participants: number;
  current_participants: number;
  location: string;
  image_url?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * 筛选参数接口
 */
export interface ActivityFilter {
  title?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  status?: string[];
}

/**
 * 构建筛选条件
 */
const buildFilterConditions = (
  request: sql.Request,
  filter: ActivityFilter,
): { whereClause: string; paramIndex: number } => {
  const conditions: string[] = [];
  let paramIndex = 0;

  if (filter.title) {
    paramIndex++;
    request.input(`title`, sql.NVarChar, `%${filter.title}%`);
    conditions.push(`title LIKE @title`);
  }

  if (filter.location) {
    paramIndex++;
    request.input(`location`, sql.NVarChar, filter.location);
    conditions.push(`location = @location`);
  }

  if (filter.startDate) {
    paramIndex++;
    request.input(`startDate`, sql.DateTime, filter.startDate);
    conditions.push(`start_time >= @startDate`);
  }

  if (filter.endDate) {
    paramIndex++;
    request.input(`endDate`, sql.DateTime, filter.endDate);
    conditions.push(`start_time <= @endDate`);
  }

  // 状态筛选
  if (filter.status && filter.status.length > 0) {
    const now = new Date().toISOString();
    const statusConditions: string[] = [];

    if (filter.status.includes("ongoing")) {
      statusConditions.push(
        `(start_time <= '${now}' AND end_time >= '${now}')`,
      );
    }
    if (filter.status.includes("upcoming")) {
      statusConditions.push(`(start_time > '${now}')`);
    }
    if (filter.status.includes("ended")) {
      statusConditions.push(`(end_time < '${now}')`);
    }
    if (filter.status.includes("full")) {
      statusConditions.push(`(current_participants >= max_participants)`);
    }

    if (statusConditions.length > 0) {
      conditions.push(`(${statusConditions.join(" OR ")})`);
    }
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { whereClause, paramIndex };
};

/**
 * 获取活动列表（支持筛选）
 */
export const getActivities = async (
  page: number = 1,
  limit: number = 10,
  filter: ActivityFilter = {},
) => {
  const offset = (page - 1) * limit;
  const request = pool.request();

  const { whereClause } = buildFilterConditions(request, filter);

  const result = await request
    .input("offset", sql.Int, offset)
    .input("limit", sql.Int, limit).query(`
      SELECT *
      FROM activities
      ${whereClause}
      ORDER BY start_time ASC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `);

  return result.recordset;
};

/**
 * 获取活动总数（支持筛选）
 */
export const getActivitiesCount = async (
  filter: ActivityFilter = {},
): Promise<number> => {
  const request = pool.request();

  const { whereClause } = buildFilterConditions(request, filter);

  const result = await request.query(`
    SELECT COUNT(*) as total
    FROM activities
    ${whereClause}
  `);

  return result.recordset[0].total;
};

export const getActivityById = async (id: number): Promise<Activity | null> => {
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query("SELECT * FROM activities WHERE id = @id");
  return result.recordset.length ? result.recordset[0] : null;
};

export const hasUserJoined = async (
  activityId: number,
  userId: number,
): Promise<boolean> => {
  const result = await pool
    .request()
    .input("activityId", sql.Int, activityId)
    .input("userId", sql.Int, userId)
    .query(
      "SELECT id FROM activity_participants WHERE activity_id = @activityId AND user_id = @userId",
    );
  return result.recordset.length > 0;
};

// 事务超时时间（毫秒）
const TRANSACTION_TIMEOUT = 5000;

/**
 * 带超时控制的事务执行函数
 * @param transaction 事务对象
 * @param operations 事务操作函数
 */
const executeTransactionWithTimeout = async <T>(
  transaction: sql.Transaction,
  operations: () => Promise<T>,
): Promise<T> => {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("TRANSACTION_TIMEOUT"));
    }, TRANSACTION_TIMEOUT);
  });

  try {
    await transaction.begin();

    const result = await Promise.race([operations(), timeoutPromise]);

    clearTimeout(timeoutId!);
    await transaction.commit();
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    await transaction.rollback();
    throw error;
  }
};

export const joinActivity = async (activityId: number, userId: number) => {
  const transaction = new sql.Transaction(pool);

  const operations = async () => {
    // 1. 先插入报名记录（使用唯一索引防止重复报名）
    try {
      await transaction
        .request()
        .input("activityId", sql.Int, activityId)
        .input("userId", sql.Int, userId).query(`
          INSERT INTO activity_participants (activity_id, user_id)
          VALUES (@activityId, @userId)
        `);
    } catch (error: any) {
      // 处理重复报名（唯一索引冲突）
      if (error.number === 2627 || error.number === 2601) {
        throw new Error("ALREADY_JOINED");
      }
      throw error;
    }

    // 2. 使用乐观锁更新人数（条件更新）
    const updateResult = await transaction
      .request()
      .input("activityId", sql.Int, activityId).query(`
        UPDATE activities
        SET current_participants = current_participants + 1
        WHERE id = @activityId 
          AND current_participants < max_participants
      `);

    // 3. 检查更新是否成功
    if (updateResult.rowsAffected[0] === 0) {
      throw new Error("ACTIVITY_FULL");
    }

    return true;
  };

  return executeTransactionWithTimeout(transaction, operations);
};

export const getUserJoinedActivities = async (userId: number) => {
  const result = await pool.request().input("userId", sql.Int, userId).query(`
      SELECT a.*
      FROM activities a
      JOIN activity_participants ap ON a.id = ap.activity_id
      WHERE ap.user_id = @userId
      ORDER BY a.start_time ASC
    `);
  return result.recordset;
};

export const createActivity = async (
  title: string,
  description: string,
  startTime: string,
  endTime: string,
  maxParticipants: number,
  location: string,
  imageUrl?: string,
) => {
  const result = await pool
    .request()
    .input("title", sql.NVarChar, title)
    .input("description", sql.NVarChar, description)
    .input("startTime", sql.DateTime, startTime)
    .input("endTime", sql.DateTime, endTime)
    .input("maxParticipants", sql.Int, maxParticipants)
    .input("location", sql.NVarChar, location)
    .input("imageUrl", sql.NVarChar, imageUrl || null).query(`
      INSERT INTO activities (title, description, start_time, end_time, max_participants, location, image_url)
      OUTPUT INSERTED.id
      VALUES (@title, @description, @startTime, @endTime, @maxParticipants, @location, @imageUrl)
    `);
  return result.recordset[0].id;
};

export const updateActivity = async (
  id: number,
  title: string,
  description: string,
  startTime: string,
  endTime: string,
  maxParticipants: number,
  location: string,
  imageUrl?: string,
) => {
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .input("title", sql.NVarChar, title)
    .input("description", sql.NVarChar, description)
    .input("startTime", sql.DateTime, startTime)
    .input("endTime", sql.DateTime, endTime)
    .input("maxParticipants", sql.Int, maxParticipants)
    .input("location", sql.NVarChar, location)
    .input("imageUrl", sql.NVarChar, imageUrl || null).query(`
      UPDATE activities
      SET title = @title,
          description = @description,
          start_time = @startTime,
          end_time = @endTime,
          max_participants = @maxParticipants,
          location = @location,
          image_url = @imageUrl,
          updated_at = GETDATE()
      WHERE id = @id
    `);
  return result;
};

export const deleteActivity = async (id: number) => {
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    // 先删除关联的参与者记录
    await transaction
      .request()
      .input("id", sql.Int, id)
      .query("DELETE FROM activity_participants WHERE activity_id = @id");

    // 再删除活动记录
    const result = await transaction
      .request()
      .input("id", sql.Int, id)
      .query("DELETE FROM activities WHERE id = @id");

    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * 获取活动参与者列表
 */
export const getActivityParticipants = async (activityId: number) => {
  const result = await pool.request().input("activityId", sql.Int, activityId)
    .query(`
    SELECT 
      u.id,
      u.username,
      u.nickname,
      u.avatar,
      ap.joined_at
    FROM activity_participants ap
    JOIN users u ON ap.user_id = u.id
    WHERE ap.activity_id = @activityId
    ORDER BY ap.joined_at ASC
  `);
  return result.recordset;
};
