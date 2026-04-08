import redisClient from "./redis.client";

const activityCacheKeys = new Set<string>();

export const setCache = async (
  key: string,
  value: unknown,
  ttl: number = 600,
): Promise<void> => {
  try {
    await redisClient.set(key, JSON.stringify(value), ttl);
    activityCacheKeys.add(key);
  } catch (error) {
    console.warn("Redis缓存设置失败:", error);
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
    console.warn("Redis缓存获取失败:", error);
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
    console.warn("Redis缓存清除失败:", error);
  } finally {
    activityCacheKeys.clear();
  }
};

export const deleteCache = async (key: string): Promise<void> => {
  try {
    await redisClient.del(key);
    activityCacheKeys.delete(key);
  } catch (error) {
    console.warn("Redis缓存删除失败:", error);
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
      const keys = await redisClient.keys(pattern);
      if (keys && keys.length > 0) {
        await redisClient.del(...keys);
        console.log(`已清除用户 ${userId} 的情绪缓存: ${keys.length} 个键`);
      }
    }
  } catch (error) {
    console.warn("清除情绪缓存失败:", error);
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

  const data = await fetchFn();
  await setMoodCache(key, data);
  return data;
};
