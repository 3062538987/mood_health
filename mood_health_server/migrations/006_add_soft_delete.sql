-- 006_add_soft_delete_and_status_clarity.sql
-- 为 posts 表添加软删除支持，以及状态字段注释

-- 添加软删除字段
ALTER TABLE posts
  ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT '软删除时间',
  ADD COLUMN deleted_by INT UNSIGNED DEFAULT NULL COMMENT '删除操作人 ID',
  ADD INDEX idx_posts_deleted (deleted_at);

-- 更新 status 字段注释以明确状态含义
ALTER TABLE posts
  MODIFY COLUMN status TINYINT NOT NULL DEFAULT 0 COMMENT '状态: 0=pending(待审核), 1=published(已发布), 2=rejected(已拒绝)';

-- 为 comments 表添加软删除支持
ALTER TABLE comments
  ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT '软删除时间',
  ADD INDEX idx_comments_deleted (deleted_at);