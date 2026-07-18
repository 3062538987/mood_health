<template>
  <div class="analysis-privacy">
    <div class="privacy-header">
      <h3>
        <i class="fas fa-shield-halved"></i> 隐私说明
      </h3>
    </div>
    
    <div class="privacy-content">
      <div class="privacy-section">
        <h4 class="section-title">本次分析使用的数据</h4>
        <div class="data-list">
          <div class="data-item">
            <i class="fas fa-check-circle text-green"></i>
            <span>你的情绪记录统计（情绪类型、强度、时间分布）</span>
          </div>
          <div class="data-item" :class="{ disabled: !usesJournalExcerpt }">
            <i :class="usesJournalExcerpt ? 'fas fa-check-circle text-green' : 'fas fa-times-circle text-gray'"></i>
            <span>你的日记正文内容</span>
            <span v-if="!usesJournalExcerpt" class="disabled-note">（本次未授权）</span>
          </div>
        </div>
      </div>

      <div class="privacy-section">
        <h4 class="section-title">数据处理方式</h4>
        <ul class="process-list">
          <li>数据仅用于生成本次分析报告，不会用于其他目的</li>
          <li>日记正文仅在你明确授权后才会发送给 AI 模型</li>
          <li>分析完成后，原始日记正文不会被保存或存储</li>
          <li>分析结果会存储在你的账户中，仅你本人可见</li>
        </ul>
      </div>

      <div class="privacy-section">
        <h4 class="section-title">你的控制权</h4>
        <div class="control-list">
          <div class="control-item">
            <i class="fas fa-toggle-on"></i>
            <div class="control-content">
              <span class="control-label">允许本次日记用于 AI 分析</span>
              <span class="control-desc">每次记录情绪时，你可以选择是否允许日记正文参与 AI 分析</span>
            </div>
          </div>
          <div class="control-item">
            <i class="fas fa-history"></i>
            <div class="control-content">
              <span class="control-label">查看分析历史</span>
              <span class="control-desc">你可以随时查看和管理所有历史分析记录</span>
            </div>
          </div>
          <div class="control-item">
            <i class="fas fa-trash"></i>
            <div class="control-content">
              <span class="control-label">删除分析记录</span>
              <span class="control-desc">你可以删除任意分析记录，相关数据会被清理</span>
            </div>
          </div>
        </div>
      </div>

      <div class="privacy-note">
        <i class="fas fa-info-circle"></i>
        <span>AI 分析仅供参考，不能替代专业心理咨询或医疗诊断。如果你感到情绪困扰，请及时寻求专业帮助。</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  usesJournalExcerpt?: boolean
}>()
</script>

<style scoped>
.analysis-privacy {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  border: 1px solid #e2e8f0;
}

.privacy-header {
  margin-bottom: 20px;
}

.privacy-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.privacy-header h3 i {
  color: #3b82f6;
}

.privacy-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.privacy-section {
  padding: 16px;
  background: #f8fafc;
  border-radius: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  margin: 0 0 12px;
}

.data-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.data-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #475569;
}

.data-item.disabled {
  opacity: 0.6;
}

.disabled-note {
  font-size: 12px;
  color: #94a3b8;
  margin-left: 8px;
}

.text-green {
  color: #22c55e;
}

.text-gray {
  color: #94a3b8;
}

.process-list {
  margin: 0;
  padding-left: 20px;
}

.process-list li {
  font-size: 14px;
  color: #475569;
  margin-bottom: 8px;
  line-height: 1.6;
}

.process-list li:last-child {
  margin-bottom: 0;
}

.control-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.control-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.control-item i {
  font-size: 16px;
  color: #3b82f6;
  margin-top: 2px;
}

.control-content {
  display: flex;
  flex-direction: column;
}

.control-label {
  font-size: 14px;
  font-weight: 500;
  color: #334155;
  margin-bottom: 2px;
}

.control-desc {
  font-size: 13px;
  color: #64748b;
}

.privacy-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 14px 16px;
  background: rgba(234, 179, 8, 0.08);
  border-radius: 10px;
  font-size: 13px;
  color: #92400e;
  line-height: 1.6;
}

.privacy-note i {
  color: #f59e0b;
}

@media (max-width: 640px) {
  .analysis-privacy {
    padding: 18px;
  }
}
</style>