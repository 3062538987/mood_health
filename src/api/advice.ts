import request from "@/utils/request";

export interface AdviceHistoryItem {
  id: number;
  userId: number;
  moodRecordId?: number;
  analysis: string;
  suggestions: string[];
  createdAt: string;
}

export interface SaveAdviceRequest {
  moodRecordId?: number;
  analysis: string;
  suggestions: string[];
}

export const saveAdvice = (data: SaveAdviceRequest) => {
  return request({
    url: "/api/moods/advice/save",
    method: "post",
    data,
  });
};

export const getAdviceHistory = (params?: { page?: number; pageSize?: number }) => {
  return request<{ list: AdviceHistoryItem[]; total: number }>({
    url: "/api/moods/advice/history",
    method: "get",
    params,
  });
};
