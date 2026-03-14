<template>
  <div class="relax-history">
    <header class="page-header">
      <h1>放松历史</h1>
      <p>查看你的放松记录，了解自己的放松习惯</p>
    </header>

    <!-- 统计卡片 -->
    <div class="stats-cards" v-if="statistics">
      <div class="stat-card">
        <div class="stat-icon">⏱</div>
        <div class="stat-info">
          <h3>今日总放松时长</h3>
          <p>{{ formatDuration(statistics.todayDuration) }}</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-info">
          <h3>本周次数</h3>
          <p>{{ statistics.thisWeekCount }}次</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🌟</div>
        <div class="stat-info">
          <h3>最常用活动</h3>
          <p>{{ getActivityName(statistics.mostUsedActivity) }}</p>
        </div>
      </div>
    </div>

    <!-- 筛选器 -->
    <div class="filter-section">
      <div class="date-filter">
        <label>日期范围：</label>
        <input type="date" v-model="filter.startDate" />
        <span>至</span>
        <input type="date" v-model="filter.endDate" />
      </div>
      <div class="activity-filter">
        <label>活动类型：</label>
        <select v-model="filter.activityType">
          <option value="">全部</option>
          <option value="woodenFish">木鱼敲击</option>
          <option value="breathing">呼吸冥想</option>
          <option value="pinball">弹珠消砖</option>
          <option value="tetris">俄罗斯方块</option>
          <option value="audio">音频放松</option>
        </select>
      </div>
      <button @click="applyFilter" class="filter-btn">筛选</button>
    </div>

    <!-- 活动占比图表 -->
    <div class="chart-section" v-if="statistics && statistics.activityBreakdown.length > 0">
      <h3>活动占比</h3>
      <div ref="chartRef" class="chart-container"></div>
    </div>

    <!-- 记录列表 -->
    <div class="records-list">
      <h3>放松记录</h3>
      <div v-if="isLoading" class="loading">加载中...</div>
      <div v-else-if="records.length === 0" class="empty">暂无记录</div>
      <div v-else class="record-list">
        <div 
          v-for="record in records" 
          :key="record.id || record.startTime"
          class="record-item"
          @click="showRecordDetail(record)"
        >
          <div class="record-icon">{{ getActivityIcon(record.activityType) }}</div>
          <div class="record-info">
            <h4>{{ getActivityName(record.activityType) }}</h4>
            <p class="record-time">{{ formatDateTime(record.startTime) }} - {{ formatDateTime(record.endTime) }}</p>
            <p class="record-duration">时长：{{ formatDuration(getRecordDuration(record)) }}</p>
            <div class="record-metrics" v-if="record.metrics">
              <span v-for="(value, key) in record.metrics" :key="key" class="metric-tag">
                {{ getMetricLabel(key) }}: {{ value }}
              </span>
            </div>
          </div>
          <div class="record-arrow">→</div>
        </div>
      </div>
    </div>

    <!-- 记录详情弹窗 -->
    <div v-if="selectedRecord" class="record-detail-modal" @click="closeRecordDetail">
      <div class="modal-content" @click.stop>
        <h3>记录详情</h3>
        <div class="detail-item">
          <label>活动类型：</label>
          <span>{{ getActivityName(selectedRecord.activityType) }}</span>
        </div>
        <div class="detail-item">
          <label>开始时间：</label>
          <span>{{ formatDateTime(selectedRecord.startTime) }}</span>
        </div>
        <div class="detail-item">
          <label>结束时间：</label>
          <span>{{ formatDateTime(selectedRecord.endTime) }}</span>
        </div>
        <div class="detail-item">
          <label>时长：</label>
          <span>{{ formatDuration(getRecordDuration(selectedRecord)) }}</span>
        </div>
        <div v-if="selectedRecord.moodTag" class="detail-item">
          <label>情绪标签：</label>
          <span>{{ selectedRecord.moodTag }}</span>
        </div>
        <div class="detail-item metrics">
          <label>活动指标：</label>
          <div class="metrics-list">
            <div v-for="(value, key) in selectedRecord.metrics" :key="key" class="metric-item">
              <span class="metric-key">{{ getMetricLabel(key) }}：</span>
              <span class="metric-value">{{ value }}</span>
            </div>
          </div>
        </div>
        <button @click="closeRecordDetail" class="close-btn">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';
import useRelaxStore from '@/stores/relaxStore';
import * as echarts from 'echarts';
import type { RelaxRecord } from '@/api/relax';

const relaxStore = useRelaxStore();
const records = ref<RelaxRecord[]>([]);
const statistics = ref(relaxStore.statistics);
const isLoading = ref(false);
const chartRef = ref<HTMLElement | null>(null);
const chartInstance = ref<echarts.ECharts | null>(null);
const selectedRecord = ref<RelaxRecord | null>(null);

const filter = ref({
  startDate: '',
  endDate: '',
  activityType: ''
});

// 初始化
onMounted(async () => {
  relaxStore.init();
  await loadData();
  initChart();
});

// 加载数据
async function loadData() {
  isLoading.value = true;
  try {
    await relaxStore.fetchStatistics();
    await relaxStore.fetchRecords();
    records.value = relaxStore.records;
    statistics.value = relaxStore.statistics;
  } catch (error) {
    console.error('加载数据失败:', error);
  } finally {
    isLoading.value = false;
  }
}

// 应用筛选
async function applyFilter() {
  isLoading.value = true;
  try {
    await relaxStore.fetchRecords({
      startDate: filter.value.startDate,
      endDate: filter.value.endDate,
      activityType: filter.value.activityType
    });
    records.value = relaxStore.records;
    updateChart();
  } catch (error) {
    console.error('筛选数据失败:', error);
  } finally {
    isLoading.value = false;
  }
}

// 初始化图表
function initChart() {
  nextTick(() => {
    if (chartRef.value) {
      chartInstance.value = echarts.init(chartRef.value);
      updateChart();
    }
  });
}

// 更新图表
function updateChart() {
  if (chartInstance.value && statistics.value) {
    const data = statistics.value.activityBreakdown.map(item => ({
      name: getActivityName(item.type),
      value: item.count
    }));

    const option = {
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        data: data.map(item => item.name)
      },
      series: [
        {
          name: '活动类型',
          type: 'pie',
          radius: '50%',
          center: ['50%', '50%'],
          data: data,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    };

    chartInstance.value.setOption(option);
  }
}

// 显示记录详情
function showRecordDetail(record: RelaxRecord) {
  selectedRecord.value = record;
}

// 关闭记录详情
function closeRecordDetail() {
  selectedRecord.value = null;
}

// 格式化日期时间
function formatDateTime(dateTime: string) {
  const date = new Date(dateTime);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// 格式化时长
function formatDuration(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`;
  } else if (minutes > 0) {
    return `${minutes}分钟${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
}

// 获取记录时长
function getRecordDuration(record: RelaxRecord) {
  const start = new Date(record.startTime).getTime();
  const end = new Date(record.endTime).getTime();
  return end - start;
}

// 获取活动图标
function getActivityIcon(activityType: string) {
  const icons: Record<string, string> = {
    woodenFish: '🪘',
    breathing: '🧘',
    pinball: '🎮',
    tetris: '🧩',
    audio: '🎵'
  };
  return icons[activityType] || '📅';
}

// 获取活动名称
function getActivityName(activityType: string) {
  const names: Record<string, string> = {
    woodenFish: '木鱼敲击',
    breathing: '呼吸冥想',
    pinball: '弹珠消砖',
    tetris: '俄罗斯方块',
    audio: '音频放松'
  };
  return names[activityType] || activityType;
}

// 获取指标标签
function getMetricLabel(key: string) {
  const labels: Record<string, string> = {
    tapCount: '敲击次数',
    focusLevel: '专注度',
    rhythmStability: '呼吸节奏',
    actualDuration: '实际时长',
    finalScore: '解压得分',
    destroyedBricks: '破坏砖块数',
    audioType: '音频类型',
    volume: '音量'
  };
  return labels[key] || key;
}

// 监听窗口大小变化，调整图表
window.addEventListener('resize', () => {
  chartInstance.value?.resize();
});
</script>

<style scoped lang="scss">
.relax-history {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
  padding: 20px;

  .page-header {
    text-align: center;
    margin-bottom: 30px;

    h1 {
      font-size: 32px;
      color: #2c3e50;
      margin: 0 0 10px 0;
      font-weight: 600;
    }

    p {
      font-size: 16px;
      color: #7f8c8d;
      margin: 0;
    }
  }

  .stats-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin-bottom: 30px;

    .stat-card {
      background: white;
      border-radius: 16px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
      transition: all 0.3s ease;

      &:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
      }

      .stat-icon {
        font-size: 40px;
        width: 60px;
        height: 60px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        border-radius: 12px;
      }

      .stat-info {
        flex: 1;

        h3 {
          margin: 0 0 4px 0;
          font-size: 14px;
          color: #7f8c8d;
          font-weight: 500;
        }

        p {
          margin: 0;
          font-size: 24px;
          color: #2c3e50;
          font-weight: 600;
        }
      }
    }
  }

  .filter-section {
    background: white;
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 30px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: center;

    .date-filter {
      display: flex;
      align-items: center;
      gap: 8px;

      label {
        font-size: 14px;
        color: #2c3e50;
        font-weight: 500;
      }

      input {
        padding: 8px 12px;
        border: 2px solid #e4e8ec;
        border-radius: 8px;
        font-size: 14px;
      }

      span {
        font-size: 14px;
        color: #7f8c8d;
      }
    }

    .activity-filter {
      display: flex;
      align-items: center;
      gap: 8px;

      label {
        font-size: 14px;
        color: #2c3e50;
        font-weight: 500;
      }

      select {
        padding: 8px 12px;
        border: 2px solid #e4e8ec;
        border-radius: 8px;
        font-size: 14px;
      }
    }

    .filter-btn {
      padding: 8px 20px;
      background: linear-gradient(135deg, #42b983 0%, #359469 100%);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.3s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(66, 185, 131, 0.3);
      }
    }
  }

  .chart-section {
    background: white;
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 30px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);

    h3 {
      margin: 0 0 20px 0;
      font-size: 18px;
      color: #2c3e50;
      font-weight: 600;
    }

    .chart-container {
      width: 100%;
      height: 400px;
    }
  }

  .records-list {
    background: white;
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);

    h3 {
      margin: 0 0 20px 0;
      font-size: 18px;
      color: #2c3e50;
      font-weight: 600;
    }

    .loading,
    .empty {
      text-align: center;
      padding: 40px 0;
      color: #7f8c8d;
    }

    .record-list {
      display: flex;
      flex-direction: column;
      gap: 16px;

      .record-item {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        border-radius: 12px;
        background: #f8f9fa;
        cursor: pointer;
        transition: all 0.3s ease;

        &:hover {
          background: #e9ecef;
          transform: translateX(4px);
        }

        .record-icon {
          font-size: 32px;
          width: 60px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .record-info {
          flex: 1;

          h4 {
            margin: 0 0 8px 0;
            font-size: 16px;
            color: #2c3e50;
            font-weight: 600;
          }

          .record-time {
            margin: 0 0 4px 0;
            font-size: 12px;
            color: #7f8c8d;
          }

          .record-duration {
            margin: 0 0 8px 0;
            font-size: 12px;
            color: #42b983;
            font-weight: 500;
          }

          .record-metrics {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;

            .metric-tag {
              padding: 4px 8px;
              background: #e3f2fd;
              color: #1976d2;
              border-radius: 12px;
              font-size: 12px;
            }
          }
        }

        .record-arrow {
          font-size: 20px;
          color: #7f8c8d;
        }
      }
    }
  }

  .record-detail-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;

    .modal-content {
      background: white;
      border-radius: 16px;
      padding: 30px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);

      h3 {
        margin: 0 0 20px 0;
        font-size: 20px;
        color: #2c3e50;
        font-weight: 600;
        text-align: center;
      }

      .detail-item {
        display: flex;
        margin-bottom: 16px;

        label {
          width: 100px;
          font-size: 14px;
          color: #7f8c8d;
          font-weight: 500;
        }

        span {
          flex: 1;
          font-size: 14px;
          color: #2c3e50;
        }

        &.metrics {
          flex-direction: column;

          label {
            width: auto;
            margin-bottom: 8px;
          }

          .metrics-list {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 8px;

            .metric-item {
              display: flex;
              
              .metric-key {
                width: 100px;
                font-size: 14px;
                color: #7f8c8d;
              }

              .metric-value {
                flex: 1;
                font-size: 14px;
                color: #2c3e50;
              }
            }
          }
        }
      }

      .close-btn {
        width: 100%;
        padding: 10px;
        background: linear-gradient(135deg, #42b983 0%, #359469 100%);
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        margin-top: 20px;
        transition: all 0.3s ease;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(66, 185, 131, 0.3);
        }
      }
    }
  }
}

@media (max-width: 768px) {
  .relax-history {
    padding: 16px;

    .page-header {
      h1 {
        font-size: 24px;
      }

      p {
        font-size: 14px;
      }
    }

    .stats-cards {
      grid-template-columns: 1fr;
      gap: 12px;

      .stat-card {
        padding: 16px;

        .stat-icon {
          font-size: 32px;
          width: 50px;
          height: 50px;
        }

        .stat-info {
          h3 {
            font-size: 12px;
          }

          p {
            font-size: 20px;
          }
        }
      }
    }

    .filter-section {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;

      .date-filter,
      .activity-filter {
        flex-direction: column;
        align-items: stretch;
        gap: 4px;

        label {
          font-size: 12px;
        }

        input,
        select {
          width: 100%;
        }
      }
    }

    .chart-section {
      padding: 16px;

      .chart-container {
        height: 300px;
      }
    }

    .records-list {
      padding: 16px;

      .record-item {
        padding: 12px;

        .record-icon {
          font-size: 24px;
          width: 50px;
          height: 50px;
        }

        .record-info {
          h4 {
            font-size: 14px;
          }

          .record-time,
          .record-duration {
            font-size: 11px;
          }

          .metric-tag {
            font-size: 11px;
            padding: 2px 6px;
          }
        }
      }
    }

    .record-detail-modal {
      .modal-content {
        padding: 20px;
        width: 95%;

        h3 {
          font-size: 18px;
        }

        .detail-item {
          flex-direction: column;
          gap: 4px;

          label {
            width: auto;
            font-size: 12px;
          }

          span {
            font-size: 14px;
          }

          &.metrics {
            .metrics-list {
              .metric-item {
                flex-direction: column;
                gap: 2px;

                .metric-key {
                  width: auto;
                  font-size: 12px;
                }

                .metric-value {
                  font-size: 14px;
                }
              }
            }
          }
        }
      }
    }
  }
}
</style>