/**
 * 帖子接口
 * @interface Post
 * @property {number} id - 帖子ID
 * @property {number} userId - 用户ID
 * @property {string} username - 用户名
 * @property {string} title - 帖子标题
 * @property {string} content - 帖子内容
 * @property {boolean} isAnonymous - 是否匿名
 * @property {number} likes - 点赞数
 * @property {number} [commentCount] - 评论数（可选）
 * @property {string} createdAt - 创建时间
 * @property {Comment[]} [comments] - 评论列表（可选）
 */
export interface Post {
  /** 帖子ID */
  id: number;
  /** 用户ID */
  userId: number;
  /** 用户名 */
  username: string;
  /** 帖子标题 */
  title: string;
  /** 帖子内容 */
  content: string;
  /** 是否匿名 */
  isAnonymous: boolean;
  /** 点赞数 */
  likes: number;
  /** 当前用户是否点赞（可选） */
  liked?: boolean;
  /** 点赞数（可选，用于树洞组件） */
  like_count?: number;
  /** 评论数（可选） */
  commentCount?: number;
  /** 创建时间 */
  createdAt: string;
  /** 评论列表（可选） */
  comments?: Comment[];
}

/**
 * 评论接口
 * @interface Comment
 * @property {number} id - 评论ID
 * @property {number} postId - 帖子ID
 * @property {number} userId - 用户ID
 * @property {string} username - 用户名
 * @property {string} content - 评论内容
 * @property {boolean} isAnonymous - 是否匿名
 * @property {string} createdAt - 创建时间
 */
export interface Comment {
  /** 评论ID */
  id: number;
  /** 帖子ID */
  postId: number;
  /** 用户ID */
  userId: number;
  /** 用户名 */
  username: string;
  /** 评论内容 */
  content: string;
  /** 是否匿名 */
  isAnonymous: boolean;
  /** 创建时间 */
  createdAt: string;
  /** 当前用户是否点赞（可选） */
  liked?: boolean;
  /** 点赞数（可选） */
  like_count?: number;
}

/**
 * 创建帖子数据接口
 * @interface CreatePostData
 * @property {string} title - 帖子标题
 * @property {string} content - 帖子内容
 * @property {boolean} isAnonymous - 是否匿名
 */
export interface CreatePostData {
  /** 帖子标题 */
  title: string;
  /** 帖子内容 */
  content: string;
  /** 是否匿名 */
  isAnonymous: boolean;
}

/**
 * 创建评论数据接口
 * @interface CreateCommentData
 * @property {number} postId - 帖子ID
 * @property {string} content - 评论内容
 * @property {boolean} isAnonymous - 是否匿名
 */
export interface CreateCommentData {
  /** 帖子ID */
  postId: number;
  /** 评论内容 */
  content: string;
  /** 是否匿名 */
  isAnonymous: boolean;
}

/**
 * 帖子列表响应接口
 * @interface PostListResponse
 * @property {Post[]} list - 帖子列表
 * @property {number} total - 总记录数
 */
export interface PostListResponse {
  /** 帖子列表 */
  list: Post[];
  /** 总记录数 */
  total: number;
}
