<template>
  <div class="setting-view">
    <div class="container">
      <h1 class="page-title">设置</h1>

      <!-- 个性化设置 -->
      <div class="setting-section">
        <h3 class="section-title">个性化设置</h3>

        <!-- 情绪记录提醒 -->
        <div class="setting-item">
          <div class="setting-info">
            <h4 class="setting-title">情绪记录提醒</h4>
            <p class="setting-description">设置每日情绪记录提醒时间</p>
          </div>
          <div class="setting-control">
            <select v-model="reminderTime" class="time-select" @change="saveSettings">
              <option v-for="time in timeOptions" :key="time" :value="time">
                {{ time }}
              </option>
            </select>
          </div>
        </div>

        <!-- 周报推送开关 -->
        <div class="setting-item">
          <div class="setting-info">
            <h4 class="setting-title">周报推送</h4>
            <p class="setting-description">每周一9点推送情绪周报</p>
          </div>
          <div class="setting-control">
            <label class="toggle-switch">
              <input v-model="weeklyReport" type="checkbox" @change="saveSettings" />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- 解压游戏音效开关 -->
        <div class="setting-item">
          <div class="setting-info">
            <h4 class="setting-title">解压游戏音效</h4>
            <p class="setting-description">开启/关闭解压游戏中的音效（如木鱼敲击声）</p>
          </div>
          <div class="setting-control">
            <label class="toggle-switch">
              <input v-model="gameSound" type="checkbox" @change="saveSettings" />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- 消息通知设置 -->
      <div class="setting-section">
        <h3 class="section-title">消息通知</h3>

        <!-- 情绪记录提醒通知 -->
        <div class="setting-item">
          <div class="setting-info">
            <h4 class="setting-title">情绪记录提醒</h4>
            <p class="setting-description">接收情绪记录提醒通知</p>
          </div>
          <div class="setting-control">
            <label class="toggle-switch">
              <input
                v-model="notifications.emotionReminder"
                type="checkbox"
                @change="saveNotifications"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- 周报生成通知 -->
        <div class="setting-item">
          <div class="setting-info">
            <h4 class="setting-title">周报生成通知</h4>
            <p class="setting-description">接收每周情绪周报生成通知</p>
          </div>
          <div class="setting-control">
            <label class="toggle-switch">
              <input
                v-model="notifications.weeklyReport"
                type="checkbox"
                @change="saveNotifications"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- 团体辅导活动提醒 -->
        <div class="setting-item">
          <div class="setting-info">
            <h4 class="setting-title">团体辅导活动提醒</h4>
            <p class="setting-description">活动前1小时接收提醒</p>
          </div>
          <div class="setting-control">
            <label class="toggle-switch">
              <input
                v-model="notifications.groupActivity"
                type="checkbox"
                @change="saveNotifications"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- 树洞留言回复 -->
        <div class="setting-item">
          <div class="setting-info">
            <h4 class="setting-title">树洞留言回复</h4>
            <p class="setting-description">接收树洞留言系统回复通知</p>
          </div>
          <div class="setting-control">
            <label class="toggle-switch">
              <input
                v-model="notifications.treeHoleReply"
                type="checkbox"
                @change="saveNotifications"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- 功能更新通知 -->
        <div class="setting-item">
          <div class="setting-info">
            <h4 class="setting-title">功能更新通知</h4>
            <p class="setting-description">接收系统功能更新通知</p>
          </div>
          <div class="setting-control">
            <label class="toggle-switch">
              <input
                v-model="notifications.featureUpdate"
                type="checkbox"
                @change="saveNotifications"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- 隐私设置 -->
      <div class="setting-section">
        <h3 class="section-title">隐私设置</h3>

        <!-- 隐私声明 -->
        <div class="setting-item">
          <div class="setting-info">
            <h4 class="setting-title">隐私声明</h4>
            <p class="setting-description">查看隐私政策和数据使用说明</p>
          </div>
          <div class="setting-control">
            <button class="action-btn" @click="showPrivacyPolicy">查看</button>
          </div>
        </div>

        <!-- 账号注销 -->
        <div class="setting-item danger">
          <div class="setting-info">
            <h4 class="setting-title">账号注销</h4>
            <p class="setting-description">注销后所有个人数据将在7个工作日内永久删除</p>
          </div>
          <div class="setting-control">
            <button class="action-btn danger-btn" @click="showDeleteAccountConfirm">注销</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 隐私声明弹窗 -->
    <div v-if="showPrivacyModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3>隐私声明</h3>
          <button class="close-btn" @click="showPrivacyModal = false">×</button>
        </div>
        <div class="modal-body">
          <h4>数据用途</h4>
          <p>1. 用户情绪记录、个人信息（微信昵称、头像）仅用于提供情绪健康服务，仅用户本人可见。</p>
          <p>2. 问卷调研数据仅用于《项目申请书》相关学术研究，且对个人信息进行匿名化处理。</p>

          <h4>存储期限</h4>
          <p>1. 个人数据将在用户使用期间持续存储。</p>
          <p>2. 账号注销后，所有个人数据将在7个工作日内永久删除。</p>

          <h4>删除权限</h4>
          <p>1. 用户有权随时要求删除个人数据。</p>
          <p>2. 用户可以通过账号注销功能删除所有个人数据。</p>
        </div>
        <div class="modal-footer">
          <button class="confirm-btn" @click="showPrivacyModal = false">我知道了</button>
        </div>
      </div>
    </div>

    <!-- 账号注销确认弹窗 -->
    <div v-if="showDeleteConfirmModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3>账号注销确认</h3>
          <button class="close-btn" @click="showDeleteConfirmModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="warning-icon">⚠️</div>
          <p class="warning-text">确定要注销账号吗？</p>
          <p>注销后，所有个人数据将在7个工作日内永久删除，此操作不可恢复。</p>
        </div>
        <div class="modal-footer">
          <button class="cancel-btn" @click="showDeleteConfirmModal = false">取消</button>
          <button class="confirm-btn danger-btn" @click="deleteAccount">确认注销</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import soundManager from '@/utils/sound'

// 个性化设置状态
const reminderTime = ref('20:00') // 情绪记录提醒时间
const weeklyReport = ref(true) // 周报推送开关
const gameSound = ref(true) // 解压游戏音效开关

// 消息通知设置
const notifications = ref({
  emotionReminder: true, // 情绪记录提醒
  weeklyReport: true, // 周报生成通知
  groupActivity: true, // 团体辅导活动提醒
  treeHoleReply: true, // 树洞留言回复
  featureUpdate: true, // 功能更新通知
})

// 弹窗状态
const showPrivacyModal = ref(false)
const showDeleteConfirmModal = ref(false)

// 时间选项（每小时一个选项）
const timeOptions = ref<string[]>([])

// 初始化时间选项
const initTimeOptions = () => {
  const times = []
  for (let hour = 0; hour < 24; hour++) {
    const time = `${hour.toString().padStart(2, '0')}:00`
    times.push(time)
  }
  timeOptions.value = times
}

// 从localStorage加载设置
onMounted(() => {
  initTimeOptions()

  // 加载个性化设置
  const savedReminderTime = localStorage.getItem('reminderTime')
  const savedWeeklyReport = localStorage.getItem('weeklyReport')
  const savedGameSound = localStorage.getItem('gameSound')

  if (savedReminderTime) {
    reminderTime.value = savedReminderTime
  }
  if (savedWeeklyReport) {
    weeklyReport.value = JSON.parse(savedWeeklyReport)
  }
  if (savedGameSound) {
    gameSound.value = JSON.parse(savedGameSound)
  }

  // 加载消息通知设置
  const savedNotifications = localStorage.getItem('notifications')
  if (savedNotifications) {
    notifications.value = JSON.parse(savedNotifications)
  }
})

// 保存个性化设置
const saveSettings = () => {
  localStorage.setItem('reminderTime', reminderTime.value)
  localStorage.setItem('weeklyReport', JSON.stringify(weeklyReport.value))
  localStorage.setItem('gameSound', JSON.stringify(gameSound.value))
  // 更新音效管理器状态
  soundManager.setSoundEnabled(gameSound.value)
}

// 保存消息通知设置
const saveNotifications = () => {
  localStorage.setItem('notifications', JSON.stringify(notifications.value))
}

// 显示隐私声明
const showPrivacyPolicy = () => {
  showPrivacyModal.value = true
}

// 显示账号注销确认
const showDeleteAccountConfirm = () => {
  showDeleteConfirmModal.value = true
}

// 账号注销
const deleteAccount = () => {
  localStorage.clear()
  showDeleteConfirmModal.value = false
  ElMessage.success('账号注销申请已提交，所有个人数据将在7个工作日内永久删除。')
}
</script>

<style scoped lang="scss">
.setting-view {
  min-height: 100vh;
  background: #f5f7fa;

  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
  }

  .page-title {
    text-align: center;
    color: #42b983;
    margin: 0 0 40px 0;
    font-size: 32px;
  }
}

// 设置区域样式
.setting-section {
  background: white;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 30px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

  .section-title {
    margin: 0 0 24px 0;
    color: #333;
    font-size: 20px;
  }
}

// 设置项样式
.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }

  &.danger {
    .setting-title {
      color: #ff4757;
    }
  }
}

// 设置信息样式
.setting-info {
  flex: 1;

  .setting-title {
    margin: 0 0 8px 0;
    color: #333;
    font-size: 16px;
  }

  .setting-description {
    margin: 0;
    color: #999;
    font-size: 14px;
    line-height: 1.4;
  }
}

// 设置控制样式
.setting-control {
  margin-left: 20px;
}

// 时间选择器样式
.time-select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
  background: white;
  cursor: pointer;
  transition: border-color 0.3s ease;

  &:hover {
    border-color: #42b983;
  }

  &:focus {
    outline: none;
    border-color: #42b983;
    box-shadow: 0 0 0 2px rgba(66, 185, 131, 0.1);
  }
}

// 开关样式
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 60px;
  height: 34px;

  input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    transition: 0.4s;
    border-radius: 34px;

    &:before {
      position: absolute;
      content: '';
      height: 26px;
      width: 26px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      transition: 0.4s;
      border-radius: 50%;
    }
  }

  input:checked + .toggle-slider {
    background-color: #42b983;
  }

  input:focus + .toggle-slider {
    box-shadow: 0 0 1px #42b983;
  }

  input:checked + .toggle-slider:before {
    transform: translateX(26px);
  }
}

// 操作按钮样式
.action-btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
  color: #333;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 14px;

  &:hover {
    border-color: #42b983;
    color: #42b983;
  }

  &.danger-btn {
    border-color: #ff4757;
    color: #ff4757;

    &:hover {
      background: #ff4757;
      color: white;
    }
  }
}

// 弹窗样式
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid #f0f0f0;

    h3 {
      margin: 0;
      color: #333;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #999;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.3s ease;

      &:hover {
        background: #f0f0f0;
        color: #333;
      }
    }
  }

  .modal-body {
    padding: 20px;

    h4 {
      margin: 16px 0 8px 0;
      color: #333;
      font-size: 16px;
    }

    p {
      margin: 8px 0;
      color: #666;
      font-size: 14px;
      line-height: 1.6;
    }

    .warning-icon {
      font-size: 48px;
      text-align: center;
      margin-bottom: 16px;
    }

    .warning-text {
      font-size: 18px;
      font-weight: bold;
      color: #ff4757;
      text-align: center;
      margin-bottom: 16px;
    }
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 20px;
    border-top: 1px solid #f0f0f0;

    .cancel-btn {
      padding: 10px 20px;
      border: 1px solid #ddd;
      border-radius: 8px;
      background: white;
      color: #333;
      cursor: pointer;
      transition: all 0.3s ease;

      &:hover {
        border-color: #ccc;
        background: #f0f0f0;
      }
    }

    .confirm-btn {
      padding: 10px 20px;
      border: 1px solid #42b983;
      border-radius: 8px;
      background: #42b983;
      color: white;
      cursor: pointer;
      transition: all 0.3s ease;

      &:hover {
        background: #388e3c;
      }

      &.danger-btn {
        border-color: #ff4757;
        background: #ff4757;

        &:hover {
          background: #e74c3c;
        }
      }
    }
  }
}

// 响应式设计
@media (max-width: 768px) {
  .setting-item {
    flex-direction: column;
    align-items: flex-start;

    .setting-control {
      margin-left: 0;
      margin-top: 12px;
    }
  }

  .page-title {
    font-size: 24px;
  }
}
</style>
