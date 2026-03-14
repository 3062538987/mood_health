import request from "@/utils/request";

interface RelaxRecord {
  id?: string;
  userId: string;
  activityType: "woodenFish" | "breathing" | "pinball" | "tetris" | "audio";
  startTime: string;
  endTime: string;
  metrics: Record<string, any>;
  moodTag?: string;
}

interface RelaxStatistics {
  todayDuration: number;
  thisWeekCount: number;
  mostUsedActivity: string;
  activityBreakdown: Array<{
    type: string;
    count: number;
    duration: number;
  }>;
}

class RelaxAPI {
  /**
   * 保存放松记录
   * @param record 放松记录数据
   */
  async saveRecord(record: Omit<RelaxRecord, "id">): Promise<RelaxRecord> {
    const response = await request<RelaxRecord>({
      url: "/api/relax/records",
      method: "post",
      data: record,
    });
    return response;
  }

  /**
   * 获取放松记录列表
   * @param params 查询参数
   */
  async getRecords(params?: {
    startDate?: string;
    endDate?: string;
    activityType?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    records: RelaxRecord[];
    total: number;
  }> {
    const response = await request<{
      records: RelaxRecord[];
      total: number;
    }>({
      url: "/api/relax/records",
      method: "get",
      params,
    });
    return response;
  }

  /**
   * 获取放松统计数据
   * @param params 查询参数
   */
  async getStatistics(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<RelaxStatistics> {
    const response = await request<RelaxStatistics>({
      url: "/api/relax/statistics",
      method: "get",
      params,
    });
    return response;
  }

  /**
   * 获取单个放松记录详情
   * @param id 记录ID
   */
  async getRecordDetail(id: string): Promise<RelaxRecord> {
    const response = await request<RelaxRecord>({
      url: `/api/relax/records/${id}`,
      method: "get",
    });
    return response;
  }
}

export default new RelaxAPI();
export type { RelaxRecord, RelaxStatistics };
