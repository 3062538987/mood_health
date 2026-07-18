import redisClient from "./redis.client";
import logger from "./logger";

const activityCacheKeys = new Set<string>()
const MAX_ACTIVITY_CACHE_KEYS = 5000

export const setCache = async (
  key: string,
  value: unknown,
  ttl: number = 600,
): Promise<void> => {
  try {
    await redisClient.set(key, JSON.stringify(value), ttl);
    // 缓存 key 有上限，防止 Set 无限增长
    if (activityCacheKeys.size >= MAX_ACTIVITY_CACHE_KEYS) {
      activityCacheKeys.clear()
      logger.warn('活动缓存 key 集合达到上限，已清空')
    }
    activityCacheKeys.add(key);
  } catch (error) {
    logger.warn("Redis缓存设置失败:", { error: (error as Error).message, key });
  }
};

export const getCache = async <T = unknown>(key: string): Promise<T | null> => {
  try {
    const cached = await redisClient.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
    return null;
  } catch (error) {
    logger.warn("Redis缓存获取失败:", { error: (error as Error).message, key });
    return null;
  }
};

export const clearActivityCache = async (): Promise<void> => {
  if (activityCacheKeys.size === 0) {
    return;
  }

  const keys = Array.from(activityCacheKeys);

  try {
    if (keys.length > 0) {
      await redisClient.del(...keys);
      console.log(`已清除 ${keys.length} 个活动缓存键`);
    }
  } catch (error) {
    logger.warn("Redis缓存清除失败:", { error: (error as Error).message, keyCount: keys.length });
  } finally {
    activityCacheKeys.clear();
  }
};

export const deleteCache = async (key: string): Promise<void> => {
  try {
    await redisClient.del(key);
    activityCacheKeys.delete(key);
  } catch (error) {
    logger.warn("Redis缓存删除失败:", { error: (error as Error).message, key });
  }
};

export const addCacheKey = (key: string): void => {
  activityCacheKeys.add(key);
};

export const getCacheKeyCount = (): number => {
  return activityCacheKeys.size;
};

const MOOD_CACHE_PREFIX = "mood";
const MOOD_CACHE_TTL = 300;

export const getMoodTrendCacheKey = (userId: number, range: string): string => {
  return `${MOOD_CACHE_PREFIX}:trend:${userId}:${range}`;
};

export const getMoodAnalysisCacheKey = (
  userId: number,
  range: string,
): string => {
  return `${MOOD_CACHE_PREFIX}:analysis:${userId}:${range}`;
};

export const getMoodWeeklyReportCacheKey = (userId: number): string => {
  return `${MOOD_CACHE_PREFIX}:weekly:${userId}`;
};

export const clearMoodCache = async (userId: number): Promise<void> => {
  const patterns = [
    `${MOOD_CACHE_PREFIX}:trend:${userId}:*`,
    `${MOOD_CACHE_PREFIX}:analysis:${userId}:*`,
    `${MOOD_CACHE_PREFIX}:weekly:${userId}`,
  ];

  try {
    for (const pattern of patterns) {
      // 使用 SCAN 替代 KEYS 避免阻塞 Redis
      let cursor = '0';
      const keysToDelete: string[] = [];
      do {
        const [newCursor, keys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = newCursor;
        keysToDelete.push(...keys);
      } while (cursor !== '0');

      if (keysToDelete.length > 0) {
        await redisClient.del(...keysToDelete);
        console.log(`已清除用户 ${userId} 的情绪缓存: ${keysToDelete.length} 个键`);
      }
    }
  } catch (error) {
    logger.warn("清除情绪缓存失败:", { error: (error as Error).message, userId });
  }
};

export const setMoodCache = async (
  key: string,
  value: unknown,
): Promise<void> => {
  await setCache(key, value, MOOD_CACHE_TTL);
};

export const getMoodCache = async <T = unknown>(
  key: string,
): Promise<T | null> => {
  return getCache<T>(key);
};

export const getOrSetMoodCache = async <T>(
  key: string,
  fetchFn: () => Promise<T>,
): Promise<T> => {
  const cached = await getMoodCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  try {
    const data = await fetchFn();
    await setMoodCache(key, data);
    return data;
  } catch (error) {
    logger.error(`缓存回填失败 (${key}):`, { error: error instanceof Error ? error.message : String(error), key });
    throw error;
  }
};
