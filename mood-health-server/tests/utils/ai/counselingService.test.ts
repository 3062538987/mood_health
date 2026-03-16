import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import counselingService from "../../../src/utils/ai/counselingService";
import { CounselingRequest } from "../../../src/models/aiModel";

describe("心理咨询服务测试", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validateRequest", () => {
    it("应该验证有效的请求", () => {
      const validRequest: CounselingRequest = {
        message: "我感到很焦虑",
        context: [{ role: "user", content: "我最近工作压力很大" }],
      };
      expect(counselingService.validateRequest(validRequest)).toBe(true);
    });

    it("应该拒绝空消息", () => {
      const invalidRequest: CounselingRequest = {
        message: "",
        context: [],
      };
      expect(counselingService.validateRequest(invalidRequest)).toBe(false);
    });

    it("应该拒绝过长的消息", () => {
      const invalidRequest: CounselingRequest = {
        message: "a".repeat(1001),
        context: [],
      };
      expect(counselingService.validateRequest(invalidRequest)).toBe(false);
    });

    it("应该拒绝过长的上下文", () => {
      const invalidRequest: CounselingRequest = {
        message: "我感到很焦虑",
        context: Array(11).fill({ role: "user", content: "test" }),
      };
      expect(counselingService.validateRequest(invalidRequest)).toBe(false);
    });
  });

  describe("generateResponse", () => {
    it("应该成功生成心理咨询响应", async () => {
      const request: CounselingRequest = {
        message: "我最近感到很焦虑，不知道该怎么办",
      };

      const result = await counselingService.generateResponse(request);

      expect(result).toHaveProperty("response");
      expect(typeof result.response).toBe("string");
      expect(result.response.length).toBeGreaterThan(0);
      expect(result.riskLevel).toBe("low");
      expect(result.hasRiskContent).toBe(false);
    });

    it("应该检测到风险内容并设置相应的风险级别", async () => {
      const request: CounselingRequest = {
        message: "我想自杀，觉得活不下去了",
      };

      const result = await counselingService.generateResponse(request);

      expect(result).toHaveProperty("response");
      expect(result.riskLevel).toBe("medium");
      expect(result.hasRiskContent).toBe(true);
      expect(result.suggestion).toBe(
        "如果你正在经历困难，建议寻求专业心理咨询师的帮助",
      );
    });

    it("应该处理带上下文的请求", async () => {
      const request: CounselingRequest = {
        message: "我还是觉得很焦虑",
        context: [
          { role: "user", content: "我最近工作压力很大" },
          {
            role: "assistant",
            content:
              "工作压力大确实会让人感到疲惫，你能具体说说是什么让你感到压力吗？",
          },
        ],
      };

      const result = await counselingService.generateResponse(request);

      expect(result).toHaveProperty("response");
      expect(typeof result.response).toBe("string");
      expect(result.response.length).toBeGreaterThan(0);
    });

    it("应该处理异常情况并返回兜底响应", async () => {
      // 模拟服务内部错误
      const mockGenerateResponse = vi.spyOn(
        counselingService,
        "generateResponse",
      );
      mockGenerateResponse.mockRejectedValue(new Error("Test error"));

      const request: CounselingRequest = {
        message: "我感到很焦虑",
      };

      const result = await counselingService.generateResponse(request);

      expect(result).toEqual({
        response: "很抱歉，我暂时无法为你提供帮助，请稍后再试",
        mood: "平静",
        riskLevel: "low",
      });

      mockGenerateResponse.mockRestore();
    });

    it("应该根据情绪类型生成相应的回复", async () => {
      const request: CounselingRequest = {
        message: "我感到很难过",
        mood: ["悲伤"],
      };

      const result = await counselingService.generateResponse(request);

      expect(result).toHaveProperty("response");
      expect(typeof result.response).toBe("string");
      expect(result.mood).toBe("悲伤");
    });
  });
});
