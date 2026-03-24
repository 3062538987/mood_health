import "../../setup";
import {
  recordMood,
  getMoodList,
  getMoodTrend,
  getMoodAnalysisHandler,
  updateMoodHandler,
  deleteMoodHandler,
  getMoodTypes,
} from "../../../src/controllers/moodController";
import { createMood, findMoodById } from "../../../src/models/moodModel";
import pool from "../../../src/config/database";

const createMockResponse = () => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as any;
};

const createMockRequest = (
  body = {},
  params = {},
  query = {},
  user = { userId: 999999 },
) =>
  ({
    body,
    params,
    query,
    user,
  }) as any;

describe("moodController", () => {
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

  describe("recordMood", () => {
    it("should create mood record successfully with valid data", async () => {
      const req = createMockRequest({
        moodType: "快乐",
        moodRatio: [7],
        event: "今天心情很好",
        tags: ["工作"],
        trigger: "完成项目",
        recordDate: testDate,
      });
      const res = createMockResponse();

      await recordMood(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 0,
          message: "记录成功",
        }),
      );
    });

    it("should return 400 when moodType is missing", async () => {
      const req = createMockRequest({
        moodRatio: [7],
      });
      const res = createMockResponse();

      await recordMood(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 400,
        }),
      );
    });

    it("should return 400 when moodRatio is missing", async () => {
      const req = createMockRequest({
        moodType: "快乐",
      });
      const res = createMockResponse();

      await recordMood(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 400,
        }),
      );
    });

    it("should return 400 when intensity is out of range (below 1)", async () => {
      const req = createMockRequest({
        moodType: "快乐",
        moodRatio: [0],
      });
      const res = createMockResponse();

      await recordMood(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 400,
          message: expect.stringContaining("强度"),
        }),
      );
    });

    it("should return 400 when intensity is out of range (above 10)", async () => {
      const req = createMockRequest({
        moodType: "快乐",
        moodRatio: [11],
      });
      const res = createMockResponse();

      await recordMood(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 400,
          message: expect.stringContaining("强度"),
        }),
      );
    });

    it("should create mood with emotions array", async () => {
      const emotionTypes = await pool
        .request()
        .query(`SELECT TOP 1 id FROM emotion_types`);
      const emotionTypeId = emotionTypes.recordset[0]?.id || 1;

      const req = createMockRequest({
        emotions: [{ emotionTypeId, intensity: 7 }],
        event: "测试事件",
        tagIds: [],
        trigger: "",
        recordDate: testDate,
      });
      const res = createMockResponse();

      await recordMood(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 0,
          message: "记录成功",
        }),
      );
    });

    it("should return 400 when emotions array has invalid intensity", async () => {
      const req = createMockRequest({
        emotions: [{ emotionTypeId: 1, intensity: 15 }],
      });
      const res = createMockResponse();

      await recordMood(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 400,
        }),
      );
    });
  });

  describe("getMoodList", () => {
    beforeEach(async () => {
      await createMood(testUserId, "快乐", 8, "记录1", "", "", testDate);
      await createMood(testUserId, "悲伤", 3, "记录2", "", "", testDate);
    });

    it("should return mood list with pagination", async () => {
      const req = createMockRequest({}, {}, { page: "1", limit: "10" });
      const res = createMockResponse();

      await getMoodList(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 0,
          data: expect.objectContaining({
            list: expect.any(Array),
            total: expect.any(Number),
            page: 1,
            limit: 10,
          }),
        }),
      );
    });

    it("should use default pagination when not provided", async () => {
      const req = createMockRequest({}, {}, {});
      const res = createMockResponse();

      await getMoodList(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 0,
          data: expect.objectContaining({
            page: 1,
          }),
        }),
      );
    });

    it("should filter by emotionTypeId when provided", async () => {
      const req = createMockRequest({}, {}, { emotionTypeId: "1" });
      const res = createMockResponse();

      await getMoodList(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 0,
        }),
      );
    });
  });

  describe("getMoodTrend", () => {
    beforeEach(async () => {
      await createMood(testUserId, "快乐", 8, "", "", "", testDate);
    });

    it("should return trend data for valid range", async () => {
      const req = createMockRequest({}, {}, { range: "week" });
      const res = createMockResponse();

      await getMoodTrend(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 0,
          data: expect.objectContaining({
            labels: expect.any(Array),
            datasets: expect.any(Array),
            summary: expect.any(String),
          }),
        }),
      );
    });

    it("should return 400 for invalid range", async () => {
      const req = createMockRequest({}, {}, { range: "invalid" });
      const res = createMockResponse();

      await getMoodTrend(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 400,
          message: "无效的时间范围",
        }),
      );
    });

    it("should default to week when range not provided", async () => {
      const req = createMockRequest({}, {}, {});
      const res = createMockResponse();

      await getMoodTrend(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 0,
        }),
      );
    });
  });

  describe("getMoodAnalysisHandler", () => {
    beforeEach(async () => {
      await createMood(testUserId, "快乐", 8, "", "工作", "", testDate);
      await createMood(testUserId, "悲伤", 3, "", "学习", "", testDate);
    });

    it("should return analysis data for valid range", async () => {
      const req = createMockRequest({}, {}, { range: "month" });
      const res = createMockResponse();

      await getMoodAnalysisHandler(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 0,
          data: expect.objectContaining({
            summary: expect.any(String),
            avgIntensity: expect.any(Number),
            positiveRatio: expect.any(Number),
            negativeRatio: expect.any(Number),
            neutralRatio: expect.any(Number),
            consecutiveLowDays: expect.any(Number),
            emotionDistribution: expect.any(Array),
            recommendations: expect.any(Array),
            trendDirection: expect.stringMatching(/improving|declining|stable/),
            recordCount: expect.any(Number),
          }),
        }),
      );
    });

    it("should return 400 for invalid range", async () => {
      const req = createMockRequest({}, {}, { range: "year" });
      const res = createMockResponse();

      await getMoodAnalysisHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 400,
          message: "无效的时间范围",
        }),
      );
    });

    it("should default to month when range not provided", async () => {
      const req = createMockRequest({}, {}, {});
      const res = createMockResponse();

      await getMoodAnalysisHandler(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 0,
        }),
      );
    });
  });

  describe("updateMoodHandler", () => {
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
      const req = createMockRequest(
        {
          moodType: "快乐",
          intensity: 8,
          note: "更新后的记录",
        },
        { id: moodId.toString() },
      );
      const res = createMockResponse();

      await updateMoodHandler(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 0,
          message: "更新成功",
        }),
      );

      const updated = await findMoodById(moodId);
      expect(updated!.mood_type).toBe("快乐");
      expect(updated!.intensity).toBe(8);
    });

    it("should return 404 for non-existent mood", async () => {
      const req = createMockRequest(
        { moodType: "快乐", intensity: 8 },
        { id: "99999999" },
      );
      const res = createMockResponse();

      await updateMoodHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 404,
          message: "记录不存在",
        }),
      );
    });

    it("should return 403 when updating other user's mood", async () => {
      const req = createMockRequest(
        { moodType: "快乐", intensity: 8 },
        { id: moodId.toString() },
        {},
        { userId: 888888 },
      );
      const res = createMockResponse();

      await updateMoodHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 403,
          message: "无权操作此记录",
        }),
      );
    });

    it("should return 400 when intensity is out of range", async () => {
      const req = createMockRequest(
        {
          emotions: [{ emotionTypeId: 1, intensity: 15 }],
        },
        { id: moodId.toString() },
      );
      const res = createMockResponse();

      await updateMoodHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("deleteMoodHandler", () => {
    let moodId: number;

    beforeEach(async () => {
      moodId = await createMood(testUserId, "快乐", 5, "", "", "", testDate);
    });

    it("should delete mood successfully", async () => {
      const req = createMockRequest({}, { id: moodId.toString() });
      const res = createMockResponse();

      await deleteMoodHandler(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 0,
          message: "删除成功",
        }),
      );

      const deleted = await findMoodById(moodId);
      expect(deleted).toBeNull();
    });

    it("should return 404 for non-existent mood", async () => {
      const req = createMockRequest({}, { id: "99999999" });
      const res = createMockResponse();

      await deleteMoodHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 404,
          message: "记录不存在",
        }),
      );
    });

    it("should return 403 when deleting other user's mood", async () => {
      const req = createMockRequest(
        {},
        { id: moodId.toString() },
        {},
        { userId: 888888 },
      );
      const res = createMockResponse();

      await deleteMoodHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 403,
          message: "无权操作此记录",
        }),
      );
    });
  });

  describe("getMoodTypes", () => {
    it("should return emotion types", async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await getMoodTypes(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 0,
          data: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(Number),
              name: expect.any(String),
            }),
          ]),
        }),
      );
    });
  });
});
