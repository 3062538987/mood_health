import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeMood, debouncedAnalyzeMood } from '@/api/moodAnalysis';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

import axios from 'axios';

describe('情绪识别功能测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('空文本拦截逻辑', () => {
    it('应该拦截空文本并抛出错误', async () => {
      await expect(
        analyzeMood({ content: '', mood_level: 5 })
      ).rejects.toThrow('情绪描述不能为空');
    });

    it('应该拦截纯空格文本并抛出错误', async () => {
      await expect(
        analyzeMood({ content: '   ', mood_level: 5 })
      ).rejects.toThrow('情绪描述不能为空');
    });

    it('应该接受非空文本', async () => {
      const mockResponse = {
        data: {
          analysis: '分析结果',
          suggestions: ['建议1'],
          mood: '开心'
        },
      };

      vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

      const result = await analyzeMood({ content: '今天心情不错', mood_level: 5 });

      expect(result).toHaveProperty('mood', '开心');
    });
  });

  describe('情绪强度验证', () => {
    it('应该拒绝小于1的情绪强度', async () => {
      await expect(
        analyzeMood({ content: '测试内容', mood_level: 0 })
      ).rejects.toThrow('情绪强度必须在1-10之间');
    });

    it('应该拒绝大于10的情绪强度', async () => {
      await expect(
        analyzeMood({ content: '测试内容', mood_level: 11 })
      ).rejects.toThrow('情绪强度必须在1-10之间');
    });

    it('应该接受有效的情绪强度范围', async () => {
      const mockResponse = {
        data: {
          analysis: '分析结果',
          suggestions: ['建议1'],
          mood: '平静'
        },
      };

      vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

      const result = await analyzeMood({ content: '测试内容', mood_level: 7 });

      expect(result).toHaveProperty('mood', '平静');
    });
  });

  describe('情绪标签有效性验证', () => {
    it('应该接受有效的情绪标签', async () => {
      const validMoods = ['开心', '焦虑', '抑郁', '平静', '愤怒', '疲惫', '紧张', '兴奋'];

      for (const mood of validMoods) {
        const mockResponse = {
          data: {
            analysis: '分析结果',
            suggestions: ['建议1'],
            mood: mood
          },
        };

        vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

        const result = await analyzeMood({ content: '测试内容', mood_level: 5 });

        expect(result.mood).toBe(mood);
      }
    });

    it('应该拒绝无效的情绪标签并使用本地fallback', async () => {
      const mockResponse = {
        data: {
          analysis: '分析结果',
          suggestions: ['建议1'],
          mood: '无效标签'
        },
      };

      vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

      const result = await analyzeMood({ content: '今天很开心', mood_level: 8 });

      expect(result.mood).toBe('开心');
    });
  });

  describe('异常情况下的兜底标签', () => {
    it('网络错误时应该返回兜底标签"未知"', async () => {
      const mockError = new Error('Network Error');
      vi.mocked(axios.post).mockRejectedValueOnce(mockError);

      const result = await analyzeMood({ content: '测试内容', mood_level: 5 });

      expect(result.mood).toBe('未知');
    });

    it('超时时应该返回兜底标签"未知"', async () => {
      const mockError = new Error('timeout') as Error & { code?: string };
      mockError.code = 'ECONNABORTED';
      vi.mocked(axios.post).mockRejectedValueOnce(mockError);

      const result = await analyzeMood({ content: '测试内容', mood_level: 5 });

      expect(result.mood).toBe('未知');
    });

    it('AI返回未知标签时应该使用本地fallback', async () => {
      const mockResponse = {
        data: {
          analysis: '分析结果',
          suggestions: ['建议1'],
          mood: '未知'
        },
      };

      vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

      const result = await analyzeMood({ content: '今天很开心', mood_level: 8 });

      expect(result.mood).toBe('开心');
    });
  });

  describe('请求防抖功能', () => {
    it('应该在500ms内多次调用只执行最后一次', async () => {
      const mockResponse = {
        data: {
          analysis: '分析结果',
          suggestions: ['建议1'],
          mood: '开心'
        },
      };

      vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

      const promises = [
        debouncedAnalyzeMood({ content: '第一次调用', mood_level: 5 }),
        debouncedAnalyzeMood({ content: '第二次调用', mood_level: 6 }),
        debouncedAnalyzeMood({ content: '第三次调用', mood_level: 7 }),
      ];

      vi.advanceTimersByTime(500);

      const results = await Promise.all(promises);

      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:8000/api/analyze-mood',
        expect.objectContaining({
          content: '第三次调用',
          mood_level: 7
        }),
        expect.any(Object)
      );
    });

    it('应该在500ms后执行请求', async () => {
      const mockResponse = {
        data: {
          analysis: '分析结果',
          suggestions: ['建议1'],
          mood: '平静'
        },
      };

      vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

      const promise = debouncedAnalyzeMood({ content: '测试内容', mood_level: 5 });

      expect(axios.post).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);

      await promise;

      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    it('应该在防抖期间取消之前的请求', async () => {
      const mockResponse = {
        data: {
          analysis: '分析结果',
          suggestions: ['建议1'],
          mood: '焦虑'
        },
      };

      vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

      debouncedAnalyzeMood({ content: '第一次调用', mood_level: 5 });
      
      vi.advanceTimersByTime(300);
      
      debouncedAnalyzeMood({ content: '第二次调用', mood_level: 6 });
      
      vi.advanceTimersByTime(500);

      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:8000/api/analyze-mood',
        expect.objectContaining({
          content: '第二次调用',
          mood_level: 6
        }),
        expect.any(Object)
      );
    });
  });

  describe('本地fallback情绪识别', () => {
    it('应该根据关键词识别"开心"情绪', async () => {
      const mockError = new Error('Network Error');
      vi.mocked(axios.post).mockRejectedValueOnce(mockError);

      const result = await analyzeMood({ content: '今天真的很开心，心情很好', mood_level: 8 });

      expect(result.mood).toBe('开心');
    });

    it('应该根据关键词识别"焦虑"情绪', async () => {
      const mockError = new Error('Network Error');
      vi.mocked(axios.post).mockRejectedValueOnce(mockError);

      const result = await analyzeMood({ content: '考试快到了，感到很焦虑', mood_level: 3 });

      expect(result.mood).toBe('焦虑');
    });

    it('应该根据关键词识别"疲惫"情绪', async () => {
      const mockError = new Error('Network Error');
      vi.mocked(axios.post).mockRejectedValueOnce(mockError);

      const result = await analyzeMood({ content: '熬夜学习，现在感觉很疲惫', mood_level: 2 });

      expect(result.mood).toBe('疲惫');
    });

    it('应该根据关键词识别"平静"情绪', async () => {
      const mockError = new Error('Network Error');
      vi.mocked(axios.post).mockRejectedValueOnce(mockError);

      const result = await analyzeMood({ content: '今天过得很平静，没有什么特别的事情', mood_level: 5 });

      expect(result.mood).toBe('平静');
    });

    it('无法识别时应该返回"未知"情绪', async () => {
      const mockError = new Error('Network Error');
      vi.mocked(axios.post).mockRejectedValueOnce(mockError);

      const result = await analyzeMood({ content: '今天天气不错，适合出去走走', mood_level: 5 });

      expect(result.mood).toBe('未知');
    });
  });
});
