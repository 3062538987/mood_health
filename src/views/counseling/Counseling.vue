<template>
  <div class="counseling-page">
    <div class="page-header">
      <h1>心理咨询陪伴</h1>
      <p class="description">专业的心理支持，温暖的心灵陪伴</p>
    </div>

    <div class="counseling-container">
      <!-- 左侧信息栏 -->
      <div class="info-panel">
        <div class="info-card">
          <h3>服务介绍</h3>
          <p>我们提供专业的心理咨询陪伴服务，帮助你缓解情绪压力，提供情感支持。</p>
        </div>

        <div class="info-card">
          <h3>服务特色</h3>
          <ul>
            <li>专业的心理支持</li>
            <li>温暖的倾听陪伴</li>
            <li>安全的对话环境</li>
            <li>24小时在线服务</li>
          </ul>
        </div>

        <div class="info-card">
          <h3>温馨提示</h3>
          <p>本服务仅提供心理支持和情感陪伴，不能替代专业医疗诊断和治疗。如有严重心理问题，请及时寻求专业医生帮助。</p>
        </div>

        <div class="contact-info">
          <h3>紧急联系</h3>
          <p>如果你正面临危机，请立即拨打：</p>
          <p class="emergency-number">全国心理危机干预热线：400-161-9995</p>
        </div>
      </div>

      <!-- 右侧聊天区域 -->
      <div class="chat-panel">
        <CounselingChat />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import CounselingChat from '@/components/counseling/CounselingChat.vue';
</script>

<style scoped lang="scss">
.counseling-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 20px;

  .page-header {
    text-align: center;
    margin-bottom: 30px;

    h1 {
      font-size: 28px;
      color: #333;
      margin-bottom: 10px;
      font-weight: 600;
    }

    .description {
      font-size: 16px;
      color: #666;
      margin: 0;
    }
  }

  .counseling-container {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 20px;
    max-width: 1200px;
    margin: 0 auto;
    min-height: 80vh;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }

    .info-panel {
      display: flex;
      flex-direction: column;
      gap: 20px;

      @media (max-width: 768px) {
        order: 2;
      }

      .info-card {
        background-color: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

        h3 {
          font-size: 16px;
          color: #333;
          margin-bottom: 12px;
          font-weight: 600;
        }

        p {
          font-size: 14px;
          color: #666;
          line-height: 1.5;
          margin: 0;
        }

        ul {
          margin: 0;
          padding-left: 20px;

          li {
            font-size: 14px;
            color: #666;
            margin-bottom: 8px;
            line-height: 1.4;
          }
        }
      }

      .contact-info {
        background-color: #fff7e6;
        border: 1px solid #ffd591;
        padding: 20px;
        border-radius: 8px;

        h3 {
          font-size: 16px;
          color: #fa8c16;
          margin-bottom: 12px;
          font-weight: 600;
        }

        p {
          font-size: 14px;
          color: #d46b08;
          line-height: 1.5;
          margin: 0 0 8px 0;
        }

        .emergency-number {
          font-size: 16px;
          font-weight: 600;
          color: #d46b08;
        }
      }
    }

    .chat-panel {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      height: 80vh;

      @media (max-width: 768px) {
        order: 1;
        height: 60vh;
      }
    }
  }
}
</style>