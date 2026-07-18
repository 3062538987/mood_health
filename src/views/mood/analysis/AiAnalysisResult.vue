<template>
  <div class="ai-analysis-result">
    <div class="result-header">
      <div class="header-left">
        <span class="ai-badge">AI 分析</span>
        <h3>{{ isSingleRecord ? '单次记录回顾' : `${periodLabel}情绪分析` }}</h3>
      </div>
      <div v-if="result?.provider || result?.model" class="provider-info">
        <span class="provider-text">{{ result.provider || 'AI' }} {{ result.model || '' }}</span>
      </div>
    </div>

    <div v-if="isSingleRecord" class="single-record-note">
      <i class="fas fa-info-circle"></i>
      <span>基于单条记录的分析仅供参考，积累更多数据后分析会更全面</span>
    </div>

    <div v-if="!hasEnoughData && !isSingleRecord" class="low-data-warning">
      <i class="fas fa-lightbulb"></i>
      <span>当前数据样本较少，分析结论可能不够稳定，建议继续记录情绪</span>
    </div>

    <div v-if="result?.warnings && result.warnings.length > 0" class="warnings-list">
      <div v-for="(warning, index) in result.warnings" :key="index" class="warning-item">
        <i class="fas fa-exclamation-triangle"></i>
        <span>{{ warning }}</span>
      </div>
    </div>

    <section class="result-section summary-section">
      <h4 class="section-title">
        <i class="fas fa-file-text"></i> 概况
      </h4>
      <p class="summary-text">{{ result?.summary || '暂无分析内容' }}</p>
    </section>

    <section v-if="result?.patterns && result.patterns.length > 0" class="result-section">
      <h4 class="section-title">
        <i class="fas fa-chart-line"></i> 发现的模式
      </h4>
      <div class="patterns-list">
        <div v-for="(pattern, index) in result.patterns" :key="index" class="pattern-card">
          <h5 class="pattern-title">{{ pattern.title }}</h5>
          <p class="pattern-observation">{{ pattern.observation }}</p>
          <div v-if="pattern.evidence && pattern.evidence.length > 0" class="pattern-evidence">
            <span class="evidence-label">依据：</span>
            <ul class="evidence-list">
              <li v-for="(ev, i) in pattern.evidence" :key="i">{{ ev }}</li>
            </ul>
          </div>
          <p v-if="pattern.caveat" class="pattern-caveat">
            <i class="fas fa-alert-circle"></i> {{ pattern.caveat }}
          </p>
        </div>
      </div>
    </section>

    <section v-if="result?.possibleFactors && result.possibleFactors.length > 0" class="result-section">
      <h4 class="section-title">
        <i class="fas fa-link"></i> 可能相关因素
      </h4>
      <div class="factors-list">
        <span
          v-for="(factor, index) in result.possibleFactors"
          :key="index"
          class="factor-tag"
        >
          {{ factor }}
        </span>
      </div>
      <p class="factors-note">这些是基于数据的推测，不一定是因果关系</p>
    </section>

    <section v-if="result?.actions && result.actions.length > 0" class="result-section">
      <h4 class="section-title">
        <i class="fas fa-check-square"></i> 建议行动
      </h4>
      <div class="actions-list">
        <div v-for="(action, index) in result.actions" :key="index" class="action-card">
          <div class="action-header">
            <h5 class="action-title">{{ action.title }}</h5>
            <span class="action-time">{{ action.estimatedMinutes }} 分钟</span>
          </div>
          <ol class="action-steps">
            <li v-for="(step, i) in action.steps" :key="i">{{ step }}</li>
          </ol>
        </div>
      </div>
    </section>

    <section v-if="result?.whenToSeekHelp" class="result-section help-section">
      <h4 class="section-title">
        <i class="fas fa-heart-pulse"></i> 何时寻求帮助
      </h4>
      <div class="help-content">
        <p>{{ result.whenToSeekHelp }}</p>
        <div class="emergency-resources">
          <span class="resource-label">紧急援助：</span>
          <a href="tel:12356" class="resource-link">全国心理援助热线 12356</a>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AiAnalysisResult, AnalysisPeriod } from '@/types/moodAnalysis'

const props = defineProps<{
  result: AiAnalysisResult | null
  period: AnalysisPeriod
  isSingleRecord?: boolean
  hasEnoughData?: boolean
}>()

const periodLabel = computed(() => {
  const map: Record<AnalysisPeriod, string> = {
    '7d': '7天',
    '1m': '1个月',
    '3m': '3个月',
    '6m': '6个月',
    '1y': '1年',
  }
  return map[props.period] || ''
})
</script>

<style scoped>
.ai-analysis-result {
  background: linear-gradient(135deg, #f5f3ff 0%, #faf5ff 100%);
  border-radius: 16px;
  padding: 24px;
  border: 1px solid #ede9fe;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ai-badge {
  font-size: 11px;
  font-weight: 600;
  color: #7c3aed;
  background: rgba(139, 92, 246, 0.12);
  padding: 3px 10px;
  border-radius: 6px;
}

.header-left h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.provider-info {
  font-size: 12px;
  color: #64748b;
}

.single-record-note,
.low-data-warning {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 10px;
  margin-bottom: 16px;
  font-size: 13px;
  line-height: 1.6;
}

.single-record-note {
  background: rgba(234, 179, 8, 0.1);
  color: #ca8a04;
}

.low-data-warning {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.warnings-list {
  margin-bottom: 16px;
}

.warning-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(239, 68, 68, 0.08);
  border-radius: 8px;
  margin-bottom: 8px;
  font-size: 13px;
  color: #dc2626;
}

.warning-item:last-child {
  margin-bottom: 0;
}

.result-section {
  margin-bottom: 20px;
}

.result-section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  margin: 0 0 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title i {
  color: #7c3aed;
}

.summary-text {
  font-size: 15px;
  line-height: 1.8;
  color: #334155;
  margin: 0;
}

.patterns-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pattern-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #e2e8f0;
}

.pattern-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 8px;
}

.pattern-observation {
  font-size: 14px;
  line-height: 1.7;
  color: #475569;
  margin: 0 0 10px;
}

.pattern-evidence {
  margin-bottom: 10px;
}

.evidence-label {
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
}

.evidence-list {
  margin: 6px 0 0 16px;
  padding: 0;
}

.evidence-list li {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 4px;
}

.pattern-caveat {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12px;
  color: #f59e0b;
  margin: 0;
  padding: 8px 12px;
  background: rgba(245, 158, 11, 0.1);
  border-radius: 8px;
}

.factors-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.factor-tag {
  padding: 6px 14px;
  background: rgba(139, 92, 246, 0.1);
  color: #7c3aed;
  border-radius: 20px;
  font-size: 13px;
}

.factors-note {
  font-size: 12px;
  color: #64748b;
  margin: 0;
}

.actions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #e2e8f0;
}

.action-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.action-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.action-time {
  font-size: 12px;
  color: #64748b;
  background: #f1f5f9;
  padding: 3px 10px;
  border-radius: 12px;
}

.action-steps {
  margin: 0;
  padding-left: 20px;
}

.action-steps li {
  font-size: 14px;
  color: #475569;
  margin-bottom: 6px;
  line-height: 1.6;
}

.action-steps li:last-child {
  margin-bottom: 0;
}

.help-section {
  background: rgba(239, 68, 68, 0.05);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(239, 68, 68, 0.1);
}

.help-content p {
  font-size: 14px;
  line-height: 1.7;
  color: #475569;
  margin: 0 0 12px;
}

.emergency-resources {
  display: flex;
  align-items: center;
  gap: 8px;
}

.resource-label {
  font-size: 12px;
  color: #64748b;
}

.resource-link {
  font-size: 13px;
  color: #dc2626;
  font-weight: 500;
}

@media (max-width: 640px) {
  .ai-analysis-result {
    padding: 18px;
  }
  
  .result-header {
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>