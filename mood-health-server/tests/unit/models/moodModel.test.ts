import {
  createMood,
  getMoodsByUser,
  getMoodAnalysis,
  getMoodTrend,
  getWeeklyReport,
  findMoodById,
  updateMood,
  deleteMood,
  getEmotionTypes,
  getTags,
} from "../../../src/models/moodModel";
import pool from "../../../src/config/database";

describe("moodModel", () => {
  const testUserId = 999999;
  const testDate = new Date().toISOString().split("T")[0];

  beforeAll(async () => {
    const result = await pool
      .request()
      .query(`SELECT TOP 1 id FROM emotion_types`);
    if (result.recordset.length === 0) {
      await pool.request().query(`
        INSERT INTO emotion_types (name, icon, category, sort_order)
        VALUES 
          ('快乐', '😊', 'positive', 1),
          ('悲伤', '😢', 'negative', 2),
          ('平静', '😌', 'neutral', 3)
      `);
    }
  });

  describe("createMood", () => {
    it("should create a mood record successfully", async () => {
      const moodId = await createMood(
        testUserId,
        "快乐",
        8,
        "今天心情很好",
        "工作",
        "完成了一个项目",
        testDate,
      );

      expect(moodId).toBeDefined();
      expect(typeof moodId).toBe("number");
      expect(moodId).toBeGreaterThan(0);
    });

    it("should create mood with multiple emotion types", async () => {
      const moodId = await createMood(
        testUserId,
        "快乐,平静",
        7,
        "情绪复杂的一天",
        "学习",
        "",
        testDate,
      );

      expect(moodId).toBeDefined();
      expect(typeof moodId).toBe("number");
    });

    it("should create mood with intensity at boundaries", async () => {
      const moodIdMin = await createMood(
        testUserId,
        "悲伤",
        1,
        "",
        "",
        "",
        testDate,
      );
      expect(moodIdMin).toBeGreaterThan(0);

      const moodIdMax = await createMood(
        testUserId,
        "快乐",
        10,
        "",
        "",
        "",
        testDate,
      );
      expect(moodIdMax).toBeGreaterThan(0);
    });
  });

  describe("getMoodsByUser", () => {
    beforeEach(async () => {
      await createMood(testUserId, "快乐", 8, "记录1", "", "", testDate);
      await createMood(testUserId, "悲伤", 3, "记录2", "", "", testDate);
      await createMood(testUserId, "平静", 5, "记录3", "", "", testDate);
    });

    it("should return moods with pagination", async () => {
      const moods = await getMoodsByUser(testUserId, 1, 2);

      expect(moods).toBeDefined();
      expect(moods.length).toBeLessThanOrEqual(2);
    });

    it("should return empty array for non-existent user", async () => {
      const moods = await getMoodsByUser(888888, 1, 10);

      expect(moods).toBeDefined();
      expect(moods.length).toBe(0);
    });

    it("should return moods in descending order by date", async () => {
      const moods = await getMoodsByUser(testUserId, 1, 10);

      if (moods.length >= 2) {
        const date1 = new Date(moods[0].record_date);
        const date2 = new Date(moods[1].record_date);
        expect(date1.getTime()).toBeGreaterThanOrEqual(date2.getTime());
      }
    });
  });

  describe("findMoodById", () => {
    let createdMoodId: number;

    beforeEach(async () => {
      createdMoodId = await createMood(
        testUserId,
        "快乐",
        7,
        "测试记录",
        "运动",
        "",
        testDate,
      );
    });

    it("should find mood by id", async () => {
      const mood = await findMoodById(createdMoodId);

      expect(mood).toBeDefined();
      expect(mood).not.toBeNull();
      expect(mood!.mood_type).toBe("快乐");
      expect(mood!.intensity).toBe(7);
    });

    it("should return null for non-existent id", async () => {
      const mood = await findMoodById(99999999);

      expect(mood).toBeNull();
    });
  });

  describe("updateMood", () => {
    let moodId: number;

    beforeEach(async () => {
      moodId = await createMood(
        testUserId,
        "悲伤",
        3,
        "原始记录",
        "",
        "",
        testDate,
      );
    });

    it("should update mood successfully", async () => {
      await updateMood(moodId, "快乐", 9, "更新后的记录", "休息", "");

      const updated = await findMoodById(moodId);
      expect(updated!.mood_type).toBe("快乐");
      expect(updated!.intensity).toBe(9);
    });

    it("should update only specified fields", async () => {
      const original = await findMoodById(moodId);

      await updateMood(moodId, "平静", original!.intensity, "", "", "");

      const updated = await findMoodById(moodId);
      expect(updated!.mood_type).toBe("平静");
      expect(updated!.intensity).toBe(original!.intensity);
    });
  });

  describe("deleteMood", () => {
    let moodId: number;

    beforeEach(async () => {
      moodId = await createMood(testUserId, "快乐", 5, "", "", "", testDate);
    });

    it("should delete mood successfully", async () => {
      await deleteMood(moodId);

      const deleted = await findMoodById(moodId);
      expect(deleted).toBeNull();
    });
  });

  describe("getMoodAnalysis", () => {
    beforeEach(async () => {
      const dates = [
        new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
      ];

      await createMood(testUserId, "快乐", 8, "", "工作", "", dates[0]);
      await createMood(testUserId, "悲伤", 3, "", "学习", "", dates[1]);
      await createMood(testUserId, "平静", 5, "", "工作", "", dates[2]);
    });

    it("should return analysis with correct structure", async () => {
      const analysis = await getMoodAnalysis(testUserId, "week");

      expect(analysis).toBeDefined();
      expect(analysis).toHaveProperty("summary");
      expect(analysis).toHaveProperty("avgIntensity");
      expect(analysis).toHaveProperty("positiveRatio");
      expect(analysis).toHaveProperty("negativeRatio");
      expect(analysis).toHaveProperty("neutralRatio");
      expect(analysis).toHaveProperty("consecutiveLowDays");
      expect(analysis).toHaveProperty("emotionDistribution");
      expect(analysis).toHaveProperty("triggerStats");
      expect(analysis).toHaveProperty("recommendations");
      expect(analysis).toHaveProperty("trendDirection");
      expect(analysis).toHaveProperty("recordCount");
      expect(analysis).toHaveProperty("dateRange");
    });

    it("should return empty analysis for user with no records", async () => {
      const analysis = await getMoodAnalysis(888888, "week");

      expect(analysis.recordCount).toBe(0);
      expect(analysis.summary).toContain("没有情绪记录");
    });

    it("should calculate average intensity correctly", async () => {
      const analysis = await getMoodAnalysis(testUserId, "week");

      expect(analysis.avgIntensity).toBeGreaterThanOrEqual(0);
      expect(analysis.avgIntensity).toBeLessThanOrEqual(10);
    });

    it("should calculate emotion ratios correctly", async () => {
      const analysis = await getMoodAnalysis(testUserId, "week");

      expect(analysis.positiveRatio).toBeGreaterThanOrEqual(0);
      expect(analysis.negativeRatio).toBeGreaterThanOrEqual(0);
      expect(analysis.neutralRatio).toBeGreaterThanOrEqual(0);

      const total =
        analysis.positiveRatio + analysis.negativeRatio + analysis.neutralRatio;
      expect(total).toBeCloseTo(1, 1);
    });

    it("should return trend direction as valid value", async () => {
      const analysis = await getMoodAnalysis(testUserId, "week");

      expect(["improving", "declining", "stable"]).toContain(
        analysis.trendDirection,
      );
    });
  });

  describe("getMoodTrend", () => {
    beforeEach(async () => {
      const dates = [
        new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
      ];

      await createMood(testUserId, "快乐", 8, "", "", "", dates[0]);
      await createMood(testUserId, "快乐", 6, "", "", "", dates[1]);
      await createMood(testUserId, "悲伤", 3, "", "", "", dates[2]);
    });

    it("should return trend data with correct structure", async () => {
      const trend = await getMoodTrend(testUserId, "week");

      expect(trend).toBeDefined();
      expect(trend).toHaveProperty("labels");
      expect(trend).toHaveProperty("datasets");
      expect(trend).toHaveProperty("summary");
      expect(Array.isArray(trend.labels)).toBe(true);
      expect(Array.isArray(trend.datasets)).toBe(true);
    });

    it("should return empty data for user with no records", async () => {
      const trend = await getMoodTrend(888888, "week");

      expect(trend.labels.length).toBe(0);
      expect(trend.datasets.length).toBe(0);
      expect(trend.summary).toContain("没有情绪记录");
    });

    it("should support different time ranges", async () => {
      const weekTrend = await getMoodTrend(testUserId, "week");
      const monthTrend = await getMoodTrend(testUserId, "month");
      const quarterTrend = await getMoodTrend(testUserId, "quarter");

      expect(weekTrend).toBeDefined();
      expect(monthTrend).toBeDefined();
      expect(quarterTrend).toBeDefined();
    });
  });

  describe("getWeeklyReport", () => {
    beforeEach(async () => {
      await createMood(testUserId, "快乐", 8, "", "", "", testDate);
      await createMood(testUserId, "快乐", 7, "", "", "", testDate);
      await createMood(testUserId, "悲伤", 3, "", "", "", testDate);
    });

    it("should return weekly report data", async () => {
      const report = await getWeeklyReport(testUserId);

      expect(Array.isArray(report)).toBe(true);
    });

    it("should return empty array for user with no records", async () => {
      const report = await getWeeklyReport(888888);

      expect(Array.isArray(report)).toBe(true);
      expect((report as any[]).length).toBe(0);
    });
  });

  describe("getEmotionTypes", () => {
    it("should return emotion types", async () => {
      const types = await getEmotionTypes();

      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);

      const type = types[0];
      expect(type).toHaveProperty("id");
      expect(type).toHaveProperty("name");
      expect(type).toHaveProperty("category");
    });
  });

  describe("getTags", () => {
    it("should return tags including system tags", async () => {
      const tags = await getTags(testUserId);

      expect(Array.isArray(tags)).toBe(true);

      if (tags.length > 0) {
        const tag = tags[0];
        expect(tag).toHaveProperty("id");
        expect(tag).toHaveProperty("name");
      }
    });
  });
});
