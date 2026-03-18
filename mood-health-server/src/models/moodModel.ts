import pool from "../config/database";
import sql from "mssql";
import {
  getMoodTrendCacheKey,
  getMoodAnalysisCacheKey,
  getMoodWeeklyReportCacheKey,
  getMoodCache,
  setMoodCache,
} from "../utils/cache";
import { encryptField, decryptField } from "../utils/encryption";

export interface Mood {
  id: number;
  user_id: number;
  mood_type: string;
  intensity: number;
  note?: string;
  tags?: string;
  trigger?: string;
  record_date: string;
  created_at: Date;
  updated_at: Date;
}

export interface EmotionType {
  id: number;
  name: string;
  icon: string;
  category: string;
  sort_order: number;
}

export interface Tag {
  id: number;
  name: string;
  user_id: number | null;
  is_system: boolean;
}

export interface MoodEmotion {
  mood_id: number;
  emotion_type_id: number;
  intensity: number;
  emotion_name?: string;
  emotion_icon?: string;
}

export interface MoodWithRelations extends Mood {
  emotions: MoodEmotion[];
  tagList: Tag[];
}

export const getEmotionTypes = async (): Promise<EmotionType[]> => {
  const result = await pool.request().query(`
    SELECT id, name, icon, category, sort_order
    FROM emotion_types
    ORDER BY sort_order
  `);
  return result.recordset;
};

export const getTags = async (userId?: number): Promise<Tag[]> => {
  const result = await pool.request().input("userId", sql.Int, userId || null)
    .query(`
      SELECT id, name, user_id, is_system
      FROM tags
      WHERE is_system = 1 OR user_id = @userId
      ORDER BY is_system DESC, name
    `);
  return result.recordset;
};

export const createMood = async (
  userId: number,
  moodType: string,
  intensity: number,
  note: string,
  tags: string,
  trigger: string,
  recordDate: string,
): Promise<number> => {
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    const encryptedNote = encryptField(note);

    const insertResult = await transaction
      .request()
      .input("userId", sql.Int, userId)
      .input("moodType", sql.NVarChar, moodType)
      .input("intensity", sql.Int, intensity)
      .input("note", sql.NVarChar(sql.MAX), encryptedNote)
      .input("tags", sql.NVarChar, tags)
      .input("trigger", sql.NVarChar, trigger)
      .input("recordDate", sql.Date, recordDate).query(`
        INSERT INTO moods (user_id, mood_type, intensity, note_encrypted, tags, [trigger], record_date)
        OUTPUT INSERTED.id
        VALUES (@userId, @moodType, @intensity, @note, @tags, @trigger, @recordDate)
      `);

    const moodId = insertResult.recordset[0].id;
    await transaction.commit();
    return moodId;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export const createMoodWithRelations = async (
  userId: number,
  emotions: { emotionTypeId: number; intensity: number }[],
  note: string,
  tagIds: number[],
  trigger: string,
  recordDate: string,
): Promise<number> => {
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    const primaryEmotion = emotions[0];
    const moodTypeNames = await getEmotionTypeNames(
      emotions.map((e) => e.emotionTypeId),
    );
    const moodTypeStr = moodTypeNames.join(",");
    const avgIntensity = Math.round(
      emotions.reduce((sum, e) => sum + e.intensity, 0) / emotions.length,
    );

    const encryptedNote = encryptField(note);

    const insertResult = await transaction
      .request()
      .input("userId", sql.Int, userId)
      .input("moodType", sql.NVarChar, moodTypeStr)
      .input("intensity", sql.Int, avgIntensity)
      .input("note", sql.NVarChar(sql.MAX), encryptedNote)
      .input("trigger", sql.NVarChar, trigger)
      .input("recordDate", sql.Date, recordDate).query(`
        INSERT INTO moods (user_id, mood_type, intensity, note_encrypted, [trigger], record_date)
        OUTPUT INSERTED.id
        VALUES (@userId, @moodType, @intensity, @note, @trigger, @recordDate)
      `);

    const moodId = insertResult.recordset[0].id;

    for (const emotion of emotions) {
      await transaction
        .request()
        .input("moodId", sql.Int, moodId)
        .input("emotionTypeId", sql.Int, emotion.emotionTypeId)
        .input("intensity", sql.Int, emotion.intensity).query(`
          INSERT INTO mood_emotions (mood_id, emotion_type_id, intensity)
          VALUES (@moodId, @emotionTypeId, @intensity)
        `);
    }

    for (const tagId of tagIds) {
      await transaction
        .request()
        .input("moodId", sql.Int, moodId)
        .input("tagId", sql.Int, tagId).query(`
          INSERT INTO mood_tags (mood_id, tag_id)
          VALUES (@moodId, @tagId)
        `);
    }

    await transaction.commit();
    return moodId;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const getEmotionTypeNames = async (
  emotionTypeIds: number[],
): Promise<string[]> => {
  if (emotionTypeIds.length === 0) return [];

  const request = pool.request();
  const placeholders = emotionTypeIds
    .map((_, index) => `@id${index}`)
    .join(",");
  emotionTypeIds.forEach((id, index) => {
    request.input(`id${index}`, sql.Int, id);
  });

  const result = await request.query(`
    SELECT name FROM emotion_types WHERE id IN (${placeholders})
  `);
  return result.recordset.map((r: { name: string }) => r.name);
};

export const getMoodsByUser = async (
  userId: number,
  page: number = 1,
  limit: number = 20,
): Promise<Mood[]> => {
  const offset = (page - 1) * limit;
  const result = await pool
    .request()
    .input("userId", sql.Int, userId)
    .input("offset", sql.Int, offset)
    .input("limit", sql.Int, limit).query(`
      SELECT id, user_id, mood_type, intensity, note_encrypted, tags, [trigger], record_date, created_at, updated_at
      FROM moods
      WHERE user_id = @userId
      ORDER BY record_date DESC, created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `);

  return result.recordset.map((row: Record<string, unknown>) => ({
    ...row,
    note: decryptField(row.note_encrypted as string),
  })) as Mood[];
};

export const getMoodsWithRelations = async (
  userId: number,
  page: number = 1,
  limit: number = 20,
): Promise<MoodWithRelations[]> => {
  const offset = (page - 1) * limit;

  const moodsResult = await pool
    .request()
    .input("userId", sql.Int, userId)
    .input("offset", sql.Int, offset)
    .input("limit", sql.Int, limit).query(`
      SELECT m.id, m.user_id, m.mood_type, m.intensity, m.note_encrypted, m.tags, m.[trigger], m.record_date, m.created_at, m.updated_at
      FROM moods m
      WHERE m.user_id = @userId
      ORDER BY m.record_date DESC, m.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `);

  const moods = moodsResult.recordset.map((row: Record<string, unknown>) => ({
    ...row,
    note: decryptField(row.note_encrypted as string),
  })) as Mood[];
  if (moods.length === 0) return [];

  const moodIds = moods.map((m: Mood) => m.id);

  const emotionsRequest = pool.request();
  const emotionPlaceholders = moodIds
    .map((_, index) => `@moodId${index}`)
    .join(",");
  moodIds.forEach((id, index) => {
    emotionsRequest.input(`moodId${index}`, sql.Int, id);
  });

  const emotionsResult = await emotionsRequest.query(`
    SELECT me.mood_id, me.emotion_type_id, me.intensity, et.name as emotion_name, et.icon as emotion_icon
    FROM mood_emotions me
    JOIN emotion_types et ON me.emotion_type_id = et.id
    WHERE me.mood_id IN (${emotionPlaceholders})
  `);

  const tagsRequest = pool.request();
  const tagPlaceholders = moodIds
    .map((_, index) => `@moodId${index}`)
    .join(",");
  moodIds.forEach((id, index) => {
    tagsRequest.input(`moodId${index}`, sql.Int, id);
  });

  const tagsResult = await tagsRequest.query(`
    SELECT mt.mood_id, t.id, t.name, t.user_id, t.is_system
    FROM mood_tags mt
    JOIN tags t ON mt.tag_id = t.id
    WHERE mt.mood_id IN (${tagPlaceholders})
  `);

  const emotionsMap = new Map<number, MoodEmotion[]>();
  for (const row of emotionsResult.recordset) {
    if (!emotionsMap.has(row.mood_id)) {
      emotionsMap.set(row.mood_id, []);
    }
    emotionsMap.get(row.mood_id)!.push({
      mood_id: row.mood_id,
      emotion_type_id: row.emotion_type_id,
      intensity: row.intensity,
      emotion_name: row.emotion_name,
      emotion_icon: row.emotion_icon,
    });
  }

  const tagsMap = new Map<number, Tag[]>();
  for (const row of tagsResult.recordset) {
    if (!tagsMap.has(row.mood_id)) {
      tagsMap.set(row.mood_id, []);
    }
    tagsMap.get(row.mood_id)!.push({
      id: row.id,
      name: row.name,
      user_id: row.user_id,
      is_system: row.is_system,
    });
  }

  return moods.map((mood: Mood) => ({
    ...mood,
    emotions: emotionsMap.get(mood.id) || [],
    tagList: tagsMap.get(mood.id) || [],
  }));
};

export interface MoodAnalysisResult {
  summary: string;
  avgIntensity: number;
  positiveRatio: number;
  negativeRatio: number;
  neutralRatio: number;
  consecutiveLowDays: number;
  dominantEmotion: string | null;
  emotionDistribution: { name: string; count: number; percentage: number }[];
  triggerStats: Record<string, Record<string, number>>;
  recommendations: string[];
  trendDirection: "improving" | "declining" | "stable";
  recordCount: number;
  dateRange: { start: string; end: string };
}

const EMOTION_CATEGORIES: Record<string, "positive" | "negative" | "neutral"> =
  {
    快乐: "positive",
    兴奋: "positive",
    悲伤: "negative",
    愤怒: "negative",
    焦虑: "negative",
    恐惧: "negative",
    平静: "neutral",
    疲惫: "neutral",
  };

const LOW_INTENSITY_THRESHOLD = 4;
const CONSECUTIVE_ALERT_THRESHOLD = 3;

export const getMoodAnalysis = async (
  userId: number,
  range: string = "month",
): Promise<MoodAnalysisResult> => {
  const cacheKey = getMoodAnalysisCacheKey(userId, range);
  const cached = await getMoodCache<MoodAnalysisResult>(cacheKey);
  if (cached) {
    return cached;
  }

  let startDate: string;
  const endDate = new Date().toISOString().split("T")[0];

  switch (range) {
    case "week":
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      break;
    case "month":
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      break;
    case "quarter":
      startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      break;
    default:
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
  }

  const moodsResult = await pool
    .request()
    .input("userId", sql.Int, userId)
    .input("startDate", sql.Date, startDate)
    .input("endDate", sql.Date, endDate).query(`
      SELECT 
        m.id,
        m.mood_type,
        m.intensity,
        m.[trigger],
        CONVERT(DATE, m.record_date) as record_date
      FROM moods m
      WHERE m.user_id = @userId
        AND m.record_date >= @startDate
        AND m.record_date <= @endDate
      ORDER BY m.record_date DESC
    `);

  const moods = moodsResult.recordset;

  if (moods.length === 0) {
    return {
      summary: "该时间范围内没有情绪记录，开始记录你的情绪吧！",
      avgIntensity: 0,
      positiveRatio: 0,
      negativeRatio: 0,
      neutralRatio: 0,
      consecutiveLowDays: 0,
      dominantEmotion: null,
      emotionDistribution: [],
      triggerStats: {},
      recommendations: ["开始记录你的情绪，了解自己的情绪模式"],
      trendDirection: "stable",
      recordCount: 0,
      dateRange: { start: startDate, end: endDate },
    };
  }

  let totalIntensity = 0;
  let positiveCount = 0;
  let negativeCount = 0;
  let neutralCount = 0;
  const emotionCounts: Record<string, number> = {};
  const triggerEmotionMap: Record<string, Record<string, number>> = {};

  for (const mood of moods) {
    totalIntensity += mood.intensity;

    const emotionTypes = mood.mood_type ? mood.mood_type.split(",") : [];
    for (const emotion of emotionTypes) {
      const trimmedEmotion = emotion.trim();
      emotionCounts[trimmedEmotion] = (emotionCounts[trimmedEmotion] || 0) + 1;

      const category = EMOTION_CATEGORIES[trimmedEmotion] || "neutral";
      if (category === "positive") positiveCount++;
      else if (category === "negative") negativeCount++;
      else neutralCount++;
    }

    if (mood.trigger) {
      const triggers = mood.trigger.split(/[,，、]/);
      for (const trigger of triggers) {
        const trimmedTrigger = trigger.trim();
        if (trimmedTrigger) {
          if (!triggerEmotionMap[trimmedTrigger]) {
            triggerEmotionMap[trimmedTrigger] = {};
          }
          for (const emotion of emotionTypes) {
            const trimmedEmotion = emotion.trim();
            triggerEmotionMap[trimmedTrigger][trimmedEmotion] =
              (triggerEmotionMap[trimmedTrigger][trimmedEmotion] || 0) + 1;
          }
        }
      }
    }
  }

  const totalEmotions = positiveCount + negativeCount + neutralCount;
  const avgIntensity = totalIntensity / moods.length;
  const positiveRatio = totalEmotions > 0 ? positiveCount / totalEmotions : 0;
  const negativeRatio = totalEmotions > 0 ? negativeCount / totalEmotions : 0;
  const neutralRatio = totalEmotions > 0 ? neutralCount / totalEmotions : 0;

  const sortedEmotions = Object.entries(emotionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const dominantEmotion =
    sortedEmotions.length > 0 ? sortedEmotions[0][0] : null;

  const emotionDistribution = sortedEmotions.map(([name, count]) => ({
    name,
    count,
    percentage: totalEmotions > 0 ? count / totalEmotions : 0,
  }));

  const dateRecords: Record<
    string,
    { intensity: number; negativeCount: number }
  > = {};
  for (const mood of moods) {
    const dateStr = mood.record_date.toISOString().split("T")[0];
    if (!dateRecords[dateStr]) {
      dateRecords[dateStr] = { intensity: 0, negativeCount: 0 };
    }
    dateRecords[dateStr].intensity = mood.intensity;

    const emotionTypes = mood.mood_type ? mood.mood_type.split(",") : [];
    for (const emotion of emotionTypes) {
      const category = EMOTION_CATEGORIES[emotion.trim()] || "neutral";
      if (category === "negative") {
        dateRecords[dateStr].negativeCount++;
      }
    }
  }

  const sortedDates = Object.keys(dateRecords).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime(),
  );
  let consecutiveLowDays = 0;
  for (const date of sortedDates) {
    const record = dateRecords[date];
    if (
      record.intensity <= LOW_INTENSITY_THRESHOLD &&
      record.negativeCount > 0
    ) {
      consecutiveLowDays++;
    } else {
      break;
    }
  }

  const sortedByDateAsc = Object.keys(dateRecords).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime(),
  );
  let trendDirection: "improving" | "declining" | "stable" = "stable";

  if (sortedByDateAsc.length >= 3) {
    const firstHalf = sortedByDateAsc.slice(
      0,
      Math.floor(sortedByDateAsc.length / 2),
    );
    const secondHalf = sortedByDateAsc.slice(
      Math.floor(sortedByDateAsc.length / 2),
    );

    const firstHalfAvg =
      firstHalf.reduce((sum, date) => sum + dateRecords[date].intensity, 0) /
      firstHalf.length;
    const secondHalfAvg =
      secondHalf.reduce((sum, date) => sum + dateRecords[date].intensity, 0) /
      secondHalf.length;

    const diff = secondHalfAvg - firstHalfAvg;
    if (diff > 0.5) trendDirection = "improving";
    else if (diff < -0.5) trendDirection = "declining";
  }

  const recommendations = generateRecommendations(
    avgIntensity,
    positiveRatio,
    negativeRatio,
    consecutiveLowDays,
    trendDirection,
    dominantEmotion,
    triggerEmotionMap,
  );

  const summary = generateSummary(
    avgIntensity,
    positiveRatio,
    negativeRatio,
    consecutiveLowDays,
    trendDirection,
    moods.length,
  );

  const result = {
    summary,
    avgIntensity: Math.round(avgIntensity * 10) / 10,
    positiveRatio: Math.round(positiveRatio * 100) / 100,
    negativeRatio: Math.round(negativeRatio * 100) / 100,
    neutralRatio: Math.round(neutralRatio * 100) / 100,
    consecutiveLowDays,
    dominantEmotion,
    emotionDistribution,
    triggerStats: triggerEmotionMap,
    recommendations,
    trendDirection,
    recordCount: moods.length,
    dateRange: { start: startDate, end: endDate },
  };

  await setMoodCache(cacheKey, result);
  return result;
};

const generateRecommendations = (
  avgIntensity: number,
  positiveRatio: number,
  negativeRatio: number,
  consecutiveLowDays: number,
  trendDirection: string,
  dominantEmotion: string | null,
  triggerStats: Record<string, Record<string, number>>,
): string[] => {
  const recommendations: string[] = [];

  if (consecutiveLowDays >= CONSECUTIVE_ALERT_THRESHOLD) {
    recommendations.push(
      `你已连续${consecutiveLowDays}天情绪低落，建议进行户外运动或与朋友倾诉`,
    );
    recommendations.push("如果持续感到困扰，可以考虑寻求专业心理咨询帮助");
  }

  if (negativeRatio > 0.6) {
    recommendations.push("近期负面情绪占比较高，建议尝试冥想或深呼吸练习");
    recommendations.push("保持规律作息，适当增加运动量有助于改善情绪");
  }

  if (avgIntensity < 3) {
    recommendations.push("整体情绪强度偏低，建议关注自己的情绪健康");
  }

  if (trendDirection === "declining") {
    recommendations.push("近期情绪呈下降趋势，建议回顾最近的生活变化");
  } else if (trendDirection === "improving") {
    recommendations.push("近期情绪呈上升趋势，继续保持积极的生活态度");
  }

  if (dominantEmotion === "焦虑") {
    recommendations.push("焦虑情绪较多时，可以尝试写下担忧的事情并逐一分析");
  } else if (dominantEmotion === "愤怒") {
    recommendations.push("愤怒情绪需要合理宣泄，运动是很好的释放方式");
  } else if (dominantEmotion === "悲伤") {
    recommendations.push("允许自己感受悲伤，同时尝试做一些让自己开心的事");
  }

  const topTriggers = Object.entries(triggerStats)
    .filter(([_, emotions]) => {
      const negativeEmotions = Object.entries(emotions).filter(
        ([emotion]) => EMOTION_CATEGORIES[emotion] === "negative",
      );
      return negativeEmotions.length > 0;
    })
    .slice(0, 2);

  for (const [trigger] of topTriggers) {
    recommendations.push(
      `"${trigger}"常引发负面情绪，建议思考如何改善这种情况`,
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("继续保持记录情绪的习惯，了解自己的情绪模式");
    if (positiveRatio > 0.5) {
      recommendations.push("近期积极情绪占比较高，继续保持乐观心态");
    }
  }

  return recommendations.slice(0, 5);
};

const generateSummary = (
  avgIntensity: number,
  positiveRatio: number,
  negativeRatio: number,
  consecutiveLowDays: number,
  trendDirection: string,
  recordCount: number,
): string => {
  let summary = `近${recordCount}条记录显示，`;

  if (avgIntensity >= 7) {
    summary += "整体情绪状态非常好，";
  } else if (avgIntensity >= 5) {
    summary += "整体情绪状态良好，";
  } else if (avgIntensity >= 3) {
    summary += "整体情绪状态一般，";
  } else {
    summary += "整体情绪状态需要关注，";
  }

  if (positiveRatio > 0.6) {
    summary += "积极情绪占主导。";
  } else if (negativeRatio > 0.6) {
    summary += "负面情绪较多。";
  } else {
    summary += "情绪分布较为均衡。";
  }

  if (consecutiveLowDays >= CONSECUTIVE_ALERT_THRESHOLD) {
    summary += `已连续${consecutiveLowDays}天情绪低落，建议关注。`;
  }

  if (trendDirection === "improving") {
    summary += "情绪趋势向好。";
  } else if (trendDirection === "declining") {
    summary += "情绪趋势有所下滑。";
  }

  return summary;
};

export const getWeeklyReport = async (userId: number) => {
  const cacheKey = getMoodWeeklyReportCacheKey(userId);
  const cached = await getMoodCache(cacheKey);
  if (cached) {
    return cached;
  }

  const result = await pool.request().input("userId", sql.Int, userId).query(`
      SELECT
          CONVERT(DATE, record_date) as date,
          mood_type,
          COUNT(*) as count,
          AVG(CAST(intensity AS FLOAT)) as avg_intensity
      FROM moods
      WHERE user_id = @userId
        AND record_date >= DATEADD(day, -7, GETDATE())
      GROUP BY CONVERT(DATE, record_date), mood_type
      ORDER BY date DESC
    `);

  await setMoodCache(cacheKey, result.recordset);
  return result.recordset;
};

export const findMoodById = async (
  id: number,
  userId?: number,
): Promise<Mood | null> => {
  const request = pool.request().input("id", sql.Int, id);
  if (userId !== undefined) {
    request.input("userId", sql.Int, userId);
  }

  const result = await request.query(`
      SELECT id, user_id, mood_type, intensity, note_encrypted, tags, [trigger], record_date, created_at, updated_at
      FROM moods WHERE id = @id ${userId === undefined ? "" : "AND user_id = @userId"}
    `);
  if (result.recordset.length === 0) return null;
  const row = result.recordset[0];
  return {
    ...row,
    note: decryptField(row.note_encrypted),
  } as Mood;
};

export const findMoodWithRelationsById = async (
  id: number,
  userId?: number,
): Promise<MoodWithRelations | null> => {
  const moodRequest = pool.request().input("id", sql.Int, id);
  if (userId !== undefined) {
    moodRequest.input("userId", sql.Int, userId);
  }

  const moodResult = await moodRequest.query(`
      SELECT id, user_id, mood_type, intensity, note_encrypted, tags, [trigger], record_date, created_at, updated_at
      FROM moods WHERE id = @id ${userId === undefined ? "" : "AND user_id = @userId"}
    `);

  if (moodResult.recordset.length === 0) return null;

  const mood = {
    ...moodResult.recordset[0],
    note: decryptField(moodResult.recordset[0].note_encrypted),
  };

  const emotionsResult = await pool.request().input("moodId", sql.Int, id)
    .query(`
      SELECT me.mood_id, me.emotion_type_id, me.intensity, et.name as emotion_name, et.icon as emotion_icon
      FROM mood_emotions me
      JOIN emotion_types et ON me.emotion_type_id = et.id
      WHERE me.mood_id = @moodId
    `);

  const tagsResult = await pool.request().input("moodId", sql.Int, id).query(`
      SELECT t.id, t.name, t.user_id, t.is_system
      FROM mood_tags mt
      JOIN tags t ON mt.tag_id = t.id
      WHERE mt.mood_id = @moodId
    `);

  return {
    ...mood,
    emotions: emotionsResult.recordset.map((row: Record<string, unknown>) => ({
      mood_id: row.mood_id,
      emotion_type_id: row.emotion_type_id,
      intensity: row.intensity,
      emotion_name: row.emotion_name,
      emotion_icon: row.emotion_icon,
    })),
    tagList: tagsResult.recordset.map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.name,
      user_id: row.user_id,
      is_system: row.is_system,
    })),
  };
};

export const updateMood = async (
  id: number,
  moodType: string,
  intensity: number,
  note: string,
  tags: string,
  trigger: string,
  userId?: number,
) => {
  const encryptedNote = encryptField(note);

  const whereClause = userId === undefined ? "WHERE id = @id" : "WHERE id = @id AND user_id = @userId";

  const request = pool
    .request()
    .input("id", sql.Int, id)
    .input("moodType", sql.NVarChar, moodType)
    .input("intensity", sql.Int, intensity)
    .input("note", sql.NVarChar(sql.MAX), encryptedNote)
    .input("tags", sql.NVarChar, tags)
    .input("trigger", sql.NVarChar, trigger);

  if (userId !== undefined) {
    request.input("userId", sql.Int, userId);
  }

  const result = await request.query(`
      UPDATE moods
      SET mood_type = @moodType,
          intensity = @intensity,
          note_encrypted = @note,
          tags = @tags,
          [trigger] = @trigger,
          updated_at = GETDATE()
      ${whereClause}
    `);
  return result.rowsAffected[0] > 0;
};

export const updateMoodWithRelations = async (
  id: number,
  emotions: { emotionTypeId: number; intensity: number }[],
  note: string,
  tagIds: number[],
  trigger: string,
  userId?: number,
): Promise<boolean> => {
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    const moodTypeNames = await getEmotionTypeNames(
      emotions.map((e) => e.emotionTypeId),
    );
    const moodTypeStr = moodTypeNames.join(",");
    const avgIntensity = Math.round(
      emotions.reduce((sum, e) => sum + e.intensity, 0) / emotions.length,
    );

    const encryptedNote = encryptField(note);

    const updateRequest = transaction
      .request()
      .input("id", sql.Int, id)
      .input("moodType", sql.NVarChar, moodTypeStr)
      .input("intensity", sql.Int, avgIntensity)
      .input("note", sql.NVarChar(sql.MAX), encryptedNote)
      .input("trigger", sql.NVarChar, trigger);

    if (userId !== undefined) {
      updateRequest.input("userId", sql.Int, userId);
    }

    const updateResult = await updateRequest.query(`
        UPDATE moods
        SET mood_type = @moodType,
            intensity = @intensity,
            note_encrypted = @note,
            [trigger] = @trigger,
            updated_at = GETDATE()
        WHERE id = @id ${userId === undefined ? "" : "AND user_id = @userId"}
      `);

    if (updateResult.rowsAffected[0] === 0) {
      await transaction.rollback();
      return false;
    }

    await transaction.request().input("moodId", sql.Int, id).query(`
      DELETE FROM mood_emotions WHERE mood_id = @moodId
    `);

    for (const emotion of emotions) {
      await transaction
        .request()
        .input("moodId", sql.Int, id)
        .input("emotionTypeId", sql.Int, emotion.emotionTypeId)
        .input("intensity", sql.Int, emotion.intensity).query(`
          INSERT INTO mood_emotions (mood_id, emotion_type_id, intensity)
          VALUES (@moodId, @emotionTypeId, @intensity)
        `);
    }

    await transaction.request().input("moodId", sql.Int, id).query(`
      DELETE FROM mood_tags WHERE mood_id = @moodId
    `);

    for (const tagId of tagIds) {
      await transaction
        .request()
        .input("moodId", sql.Int, id)
        .input("tagId", sql.Int, tagId).query(`
          INSERT INTO mood_tags (mood_id, tag_id)
          VALUES (@moodId, @tagId)
        `);
    }

    await transaction.commit();
    return true;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export const deleteMood = async (id: number, userId?: number) => {
  const request = pool.request().input("id", sql.Int, id);
  const whereClause = userId === undefined ? "WHERE id = @id" : "WHERE id = @id AND user_id = @userId";

  if (userId !== undefined) {
    request.input("userId", sql.Int, userId);
  }

  const result = await request.query(`DELETE FROM moods ${whereClause}`);
  return result.rowsAffected[0] > 0;
};

export const getMoodTrend = async (userId: number, range: string) => {
  const cacheKey = getMoodTrendCacheKey(userId, range);
  const cached = await getMoodCache<{
    labels: string[];
    datasets: { name: string; data: (number | null)[] }[];
    summary: string;
  }>(cacheKey);
  if (cached) {
    return cached;
  }

  let startDate: string;
  const endDate = new Date().toISOString().split("T")[0];

  switch (range) {
    case "week":
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      break;
    case "month":
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      break;
    case "quarter":
      startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      break;
    default:
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
  }

  const queryResult = await pool
    .request()
    .input("userId", sql.Int, userId)
    .input("startDate", sql.Date, startDate)
    .input("endDate", sql.Date, endDate).query(`
      SELECT 
        CONVERT(DATE, record_date) as date,
        mood_type,
        AVG(CAST(intensity AS FLOAT)) as avg_intensity
      FROM moods
      WHERE user_id = @userId
        AND record_date >= @startDate
        AND record_date <= @endDate
      GROUP BY CONVERT(DATE, record_date), mood_type
      ORDER BY date ASC
    `);

  const records = queryResult.recordset;

  const dates = Array.from(
    new Set(records.map((r: { date: string }) => r.date)),
  ).sort();
  const moodTypes = Array.from(
    new Set(records.map((r: { mood_type: string }) => r.mood_type)),
  );

  const datasets = moodTypes.map((type: string) => {
    const data = dates.map((date: string) => {
      const record = records.find(
        (r: { date: string; mood_type: string }) =>
          r.date === date && r.mood_type === type,
      );
      return record ? record.avg_intensity : null;
    });
    return {
      name: type,
      data: data,
    };
  });

  let summary = "";
  if (records.length === 0) {
    summary = "该时间范围内没有情绪记录。";
  } else {
    const avgIntensity =
      records.reduce(
        (sum: number, r: { avg_intensity: number }) => sum + r.avg_intensity,
        0,
      ) / records.length;
    if (avgIntensity >= 4) {
      summary = "近期情绪状态良好，继续保持积极的生活态度。";
    } else if (avgIntensity >= 3) {
      summary = "近期情绪状态平稳，建议适当放松和休息。";
    } else if (avgIntensity >= 2) {
      summary = "近期情绪波动较大，建议多进行放松练习。";
    } else {
      summary = "近期情绪状态较差，建议寻求专业帮助或与朋友倾诉。";
    }
  }

  const result = {
    labels: dates,
    datasets: datasets,
    summary: summary,
  };

  await setMoodCache(cacheKey, result);
  return result;
};

export const createOrGetTag = async (
  name: string,
  userId: number,
): Promise<number> => {
  const existingTag = await pool
    .request()
    .input("name", sql.NVarChar, name)
    .input("userId", sql.Int, userId).query(`
      SELECT id FROM tags WHERE name = @name AND (is_system = 1 OR user_id = @userId)
    `);

  if (existingTag.recordset.length > 0) {
    return existingTag.recordset[0].id;
  }

  const result = await pool
    .request()
    .input("name", sql.NVarChar, name)
    .input("userId", sql.Int, userId).query(`
      INSERT INTO tags (name, user_id, is_system)
      OUTPUT INSERTED.id
      VALUES (@name, @userId, 0)
    `);

  return result.recordset[0].id;
};

export const getMoodsByEmotionType = async (
  userId: number,
  emotionTypeId: number,
  page: number = 1,
  limit: number = 20,
): Promise<MoodWithRelations[]> => {
  const offset = (page - 1) * limit;

  const moodsResult = await pool
    .request()
    .input("userId", sql.Int, userId)
    .input("emotionTypeId", sql.Int, emotionTypeId)
    .input("offset", sql.Int, offset)
    .input("limit", sql.Int, limit).query(`
      SELECT DISTINCT m.id, m.user_id, m.mood_type, m.intensity, m.note_encrypted, m.tags, m.[trigger], m.record_date, m.created_at, m.updated_at
      FROM moods m
      JOIN mood_emotions me ON m.id = me.mood_id
      WHERE m.user_id = @userId AND me.emotion_type_id = @emotionTypeId
      ORDER BY m.record_date DESC, m.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `);

  const moods = moodsResult.recordset.map((row: Record<string, unknown>) => ({
    ...row,
    note: decryptField(row.note_encrypted as string),
  })) as Mood[];
  if (moods.length === 0) return [];

  const moodIds = moods.map((m: Mood) => m.id);

  const emotionsRequest = pool.request();
  const emotionPlaceholders = moodIds
    .map((_, index) => `@moodId${index}`)
    .join(",");
  moodIds.forEach((id, index) => {
    emotionsRequest.input(`moodId${index}`, sql.Int, id);
  });

  const emotionsResult = await emotionsRequest.query(`
    SELECT me.mood_id, me.emotion_type_id, me.intensity, et.name as emotion_name, et.icon as emotion_icon
    FROM mood_emotions me
    JOIN emotion_types et ON me.emotion_type_id = et.id
    WHERE me.mood_id IN (${emotionPlaceholders})
  `);

  const tagsRequest = pool.request();
  const tagPlaceholders = moodIds
    .map((_, index) => `@moodId${index}`)
    .join(",");
  moodIds.forEach((id, index) => {
    tagsRequest.input(`moodId${index}`, sql.Int, id);
  });

  const tagsResult = await tagsRequest.query(`
    SELECT mt.mood_id, t.id, t.name, t.user_id, t.is_system
    FROM mood_tags mt
    JOIN tags t ON mt.tag_id = t.id
    WHERE mt.mood_id IN (${tagPlaceholders})
  `);

  const emotionsMap = new Map<number, MoodEmotion[]>();
  for (const row of emotionsResult.recordset) {
    if (!emotionsMap.has(row.mood_id)) {
      emotionsMap.set(row.mood_id, []);
    }
    emotionsMap.get(row.mood_id)!.push({
      mood_id: row.mood_id,
      emotion_type_id: row.emotion_type_id,
      intensity: row.intensity,
      emotion_name: row.emotion_name,
      emotion_icon: row.emotion_icon,
    });
  }

  const tagsMap = new Map<number, Tag[]>();
  for (const row of tagsResult.recordset) {
    if (!tagsMap.has(row.mood_id)) {
      tagsMap.set(row.mood_id, []);
    }
    tagsMap.get(row.mood_id)!.push({
      id: row.id,
      name: row.name,
      user_id: row.user_id,
      is_system: row.is_system,
    });
  }

  return moods.map((mood: Mood) => ({
    ...mood,
    emotions: emotionsMap.get(mood.id) || [],
    tagList: tagsMap.get(mood.id) || [],
  }));
};
