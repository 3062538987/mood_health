<template>
  <div class="tree-hole-audit">
    <div class="container">
      <h2>树洞内容审核</h2>
      
      <div class="stats">
        <div class="stat-card">
          <div class="stat-icon">📋</div>
          <div class="stat-info">
            <h3>待审核</h3>
            <p>{{ pendingCount }}</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">✅</div>
          <div class="stat-info">
            <h3>已通过</h3>
            <p>{{ approvedCount }}</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">❌</div>
          <div class="stat-info">
            <h3>已拒绝</h3>
            <p>{{ rejectedCount }}</p>
          </div>
        </div>
      </div>

      <div class="filter-bar">
        <select v-model="statusFilter" @change="loadPosts">
          <option value="0">待审核</option>
          <option value="1">已通过</option>
          <option value="2">已拒绝</option>
        </select>
        <button class="refresh-btn" @click="loadPosts">
          <i class="fas fa-redo"></i> 刷新
        </button>
      </div>

      <div v-if="loading" class="loading">
        <i class="fas fa-spinner fa-spin"></i> 加载中...
      </div>

      <div v-else-if="posts.length === 0" class="empty">
        <i class="fas fa-inbox"></i>
        <p>暂无待审核内容</p>
      </div>

      <div v-else class="posts-list">
        <div
          v-for="post in posts"
          :key="post.id"
          class="post-card"
          :class="{ 'status-0': post.status === 0, 'status-1': post.status === 1, 'status-2': post.status === 2 }"
        >
          <div class="post-header">
            <div class="post-info">
              <span class="post-title">{{ post.title }}</span>
              <span class="post-author">
                {{ post.is_anonymous ? '匿名用户' : post.username || '未知用户' }}
              </span>
              <span class="post-time">{{ formatTime(post.created_at) }}</span>
            </div>
            <div class="post-status" :class="`status-${post.status}`">
              {{ getStatusText(post.status) }}
            </div>
          </div>

          <div class="post-content">{{ post.content }}</div>

          <div v-if="post.audit_remark" class="audit-remark">
            <strong>审核备注：</strong>{{ post.audit_remark }}
          </div>

          <div v-if="post.status === 0" class="post-actions">
            <button class="btn btn-reject" @click="showRejectDialog(post)">
              <i class="fas fa-times"></i> 拒绝
            </button>
            <button class="btn btn-approve" @click="approvePost(post.id)">
              <i class="fas fa-check"></i> 通过
            </button>
          </div>
        </div>
      </div>

      <div class="pagination">
        <button @click="changePage(currentPage - 1)" :disabled="currentPage <= 1">上一页</button>
        <span>第 {{ currentPage }} 页</span>
        <button @click="changePage(currentPage + 1)" :disabled="posts.length < pageSize">下一页</button>
      </div>
    </div>

    <div v-if="showRejectModal" class="modal-overlay" @click="closeRejectDialog">
      <div class="modal-content" @click.stop>
        <h3>拒绝帖子</h3>
        <textarea
          v-model="rejectRemark"
          placeholder="请输入拒绝原因（可选）"
          rows="4"
        ></textarea>
        <div class="modal-actions">
          <button class="btn btn-cancel" @click="closeRejectDialog">取消</button>
          <button class="btn btn-confirm" @click="confirmReject">确认拒绝</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { getPendingPosts, auditPost } from '@/api/post';

const posts = ref<any[]>([]);
const loading = ref(false);
const currentPage = ref(1);
const pageSize = ref(10);
const statusFilter = ref(0);
const showRejectModal = ref(false);
const currentPost = ref<any | null>(null);
const rejectRemark = ref('');

const pendingCount = ref(0);
const approvedCount = ref(0);
const rejectedCount = ref(0);

const loadPosts = async () => {
  loading.value = true;
  try {
    const data = await getPendingPosts(currentPage.value, pageSize.value);
    posts.value = data;
    updateStats();
  } catch (error) {
    ElMessage.error('获取待审核帖子失败');
    console.error(error);
  } finally {
    loading.value = false;
  }
};

const updateStats = () => {
  pendingCount.value = posts.value.filter(p => p.status === 0).length;
  approvedCount.value = posts.value.filter(p => p.status === 1).length;
  rejectedCount.value = posts.value.filter(p => p.status === 2).length;
};

const changePage = async (page: number) => {
  if (page < 1) return;
  currentPage.value = page;
  await loadPosts();
};

const formatTime = (date: string) => {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return d.toLocaleDateString('zh-CN');
};

const getStatusText = (status: number) => {
  switch (status) {
    case 0: return '待审核';
    case 1: return '已通过';
    case 2: return '已拒绝';
    default: return '未知';
  }
};

const showRejectDialog = (post: any) => {
  currentPost.value = post;
  rejectRemark.value = '';
  showRejectModal.value = true;
};

const closeRejectDialog = () => {
  showRejectModal.value = false;
  currentPost.value = null;
  rejectRemark.value = '';
};

const confirmReject = async () => {
  if (!currentPost.value) return;
  
  try {
    await auditPost(currentPost.value.id, {
      status: 2,
      audit_remark: rejectRemark.value || undefined
    });
    ElMessage.success('已拒绝该帖子');
    closeRejectDialog();
    await loadPosts();
  } catch (error) {
    ElMessage.error('操作失败');
    console.error(error);
  }
};

const approvePost = async (postId: number) => {
  try {
    await auditPost(postId, { status: 1 });
    ElMessage.success('已通过该帖子');
    await loadPosts();
  } catch (error) {
    ElMessage.error('操作失败');
    console.error(error);
  }
};

onMounted(loadPosts);
</script>

<style scoped lang="scss">
@import '@/assets/styles/theme.scss';

.tree-hole-audit {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;

  h2 {
    text-align: center;
    margin-bottom: 30px;
    color: $text-color;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-bottom: 30px;

    .stat-card {
      background: $white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      gap: 15px;

      .stat-icon {
        font-size: 2rem;
      }

      .stat-info {
        h3 {
          margin: 0 0 5px 0;
          font-size: 0.9rem;
          color: $text-light-color;
        }

        p {
          margin: 0;
          font-size: 1.5rem;
          font-weight: bold;
          color: $primary-color;
        }
      }
    }
  }

  .filter-bar {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;

    select {
      padding: 8px 12px;
      border: 1px solid $border-color;
      border-radius: 4px;
      background: $white;
      color: $text-color;
    }

    .refresh-btn {
      padding: 8px 16px;
      background: $white;
      border: 1px solid $border-color;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      transition: all 0.3s;

      &:hover {
        background: $primary-color;
        color: $white;
        border-color: $primary-color;
      }
    }
  }

  .loading,
  .empty {
    text-align: center;
    padding: 40px;
    color: $text-light-color;

    i {
      font-size: 3rem;
      margin-bottom: 10px;
    }
  }

  .posts-list {
    display: flex;
    flex-direction: column;
    gap: 15px;

    .post-card {
      background: $white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      border-left: 4px solid $border-color;

      &.status-0 {
        border-left-color: #f39c12;
      }

      &.status-1 {
        border-left-color: #27ae60;
      }

      &.status-2 {
        border-left-color: #e74c3c;
      }

      .post-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;

        .post-info {
          display: flex;
          align-items: center;
          gap: 15px;
          flex-wrap: wrap;

          .post-title {
            font-weight: bold;
            font-size: 1.1rem;
            color: $text-color;
          }

          .post-author {
            color: $text-light-color;
            font-size: 0.9rem;
          }

          .post-time {
            color: $text-light-color;
            font-size: 0.85rem;
          }
        }

        .post-status {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 0.85rem;
          font-weight: 500;

          &.status-0 {
            background: #fef3cd;
            color: #856404;
          }

          &.status-1 {
            background: #d4edda;
            color: #155724;
          }

          &.status-2 {
            background: #f8d7da;
            color: #721c24;
          }
        }
      }

      .post-content {
        color: $text-color;
        line-height: 1.6;
        margin-bottom: 15px;
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      .audit-remark {
        background: #f8f9fa;
        padding: 10px;
        border-radius: 4px;
        margin-bottom: 15px;
        font-size: 0.9rem;
        color: $text-light-color;

        strong {
          color: $text-color;
        }
      }

      .post-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: all 0.3s;

          &.btn-reject {
            background: #e74c3c;
            color: $white;

            &:hover {
              background: #c0392b;
            }
          }

          &.btn-approve {
            background: #27ae60;
            color: $white;

            &:hover {
              background: #229954;
            }
          }
        }
      }
    }
  }

  .pagination {
    display: flex;
    justify-content: center;
    gap: 15px;
    margin-top: 30px;

    button {
      padding: 8px 16px;
      background: $white;
      border: 1px solid $border-color;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.3s;

      &:hover:not(:disabled) {
        background: $primary-color;
        color: $white;
        border-color: $primary-color;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  }

  .modal-overlay {
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
      background: $white;
      padding: 25px;
      border-radius: 8px;
      width: 90%;
      max-width: 500px;

      h3 {
        margin: 0 0 15px 0;
        color: $text-color;
      }

      textarea {
        width: 100%;
        padding: 10px;
        border: 1px solid $border-color;
        border-radius: 4px;
        resize: vertical;
        font-family: inherit;
        margin-bottom: 15px;

        &:focus {
          outline: none;
          border-color: $primary-color;
        }
      }

      .modal-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;

        .btn {
          padding: 8px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.3s;

          &.btn-cancel {
            background: #95a5a6;
            color: $white;

            &:hover {
              background: #7f8c8d;
            }
          }

          &.btn-confirm {
            background: #e74c3c;
            color: $white;

            &:hover {
              background: #c0392b;
            }
          }
        }
      }
    }
  }
}

@media (max-width: 768px) {
  .tree-hole-audit {
    padding: 10px;

    .stats {
      grid-template-columns: 1fr;
    }

    .posts-list {
      .post-card {
        .post-header {
          .post-info {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        .post-actions {
          flex-direction: column;

          .btn {
            width: 100%;
            justify-content: center;
          }
        }
      }
    }
  }
}
</style>
