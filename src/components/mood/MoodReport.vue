<template>
  <div class="mood-report">
    <h3>情绪分析报告</h3>
    <div class="report-stats">
      <div class="stat-card">
        <span class="stat-title">本月主导情绪</span>
        <span class="stat-value">平静 (35%)</span>
      </div>
      <div class="stat-card">
        <span class="stat-title">情绪波动次数</span>
        <span class="stat-value">8次</span>
      </div>
      <div class="stat-card">
        <span class="stat-title">愉悦指数</span>
        <span class="stat-value">7.2/10</span>
      </div>
    </div>
    <div class="report-chart">
      <h4>情绪分布趋势</h4>
      <div class="chart-bar">
        <div class="bar-item">
          <span>开心</span>
          <div class="bar" style="width: 30%"></div>
        </div>
        <div class="bar-item">
          <span>平静</span>
          <div class="bar" style="width: 35%"></div>
        </div>
        <div class="bar-item">
          <span>焦虑</span>
          <div class="bar" style="width: 20%"></div>
        </div>
        <div class="bar-item">
          <span>难过</span>
          <div class="bar" style="width: 15%"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 后续可对接接口获取真实数据
</script>

<style scoped lang="scss">
.mood-report {
  padding: 16px;
  .report-stats {
    display: flex;
    gap: 16px;
    margin-bottom: 20px;
    .stat-card {
      flex: 1;
      padding: 12px;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      .stat-title {
        color: #7f8c8d;
        font-size: 14px;
      }
      .stat-value {
        font-size: 18px;
        font-weight: 700;
        margin-top: 8px;
        display: block;
      }
    }
  }
  .report-chart {
    background: #fff;
    padding: 16px;
    border-radius: 8px;
    .chart-bar {
      margin-top: 12px;
      .bar-item {
        display: flex;
        align-items: center;
        margin-bottom: 12px;
        span {
          width: 60px;
        }
        .bar {
          height: 20px;
          background: #42b983;
          border-radius: 4px;
        }
      }
    }
  }
}
</style>
