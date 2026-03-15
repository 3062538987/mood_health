# 大学生情绪健康系统-前端|后端应用

# 大学生情绪健康系统 - 前端应用

# 项目介绍

大学生情绪健康系统前端应用是一个基于 Vue 3 + TypeScript + Vite 的单页应用（SPA），为大学生提供情绪管理、心理评估、放松训练等功能的前端界面。系统采用现代化的前端技术栈，提供流畅的用户体验和良好的交互效果。

### 主要功能

- **用户认证**：用户注册、登录、个人信息管理
- **情绪管理**：情绪记录、情绪分析、情绪历史查看
- **心理评估**：问卷填写、问卷结果查看、历史记录
- **放松训练**：音乐治疗、放松历史记录
- **课程学习**：心理健康课程浏览、课程详情查看
- **活动管理**：团体活动浏览、活动详情、活动报名
- **树洞功能**：匿名发布、评论互动、内容浏览
- **成就系统**：成就展示、进度追踪
- **响应式设计**：适配桌面端和移动端

## 技术栈

### 核心技术

- **Vue 3**：渐进式 JavaScript 框架
- **TypeScript**：JavaScript 的超集，提供静态类型检查
- **Vite**：下一代前端构建工具

### UI 框架和组件库

- **Vue Router**：Vue 官方路由管理器
- **Pinia**：Vue 官方状态管理库
- **Element Plus**：基于 Vue 3 的组件库
- **Axios**：HTTP 客户端，用于 API 请求

### 主要依赖

- **@vueuse/core**：Vue Composition API 工具集
- **echarts**：数据可视化图表库
- **dayjs**：轻量级日期处理库
- **sass**：CSS 预处理器
- **compression**：响应压缩中间件

### 开发工具

- **@vitejs/plugin-vue**：Vite 的 Vue 插件
- **typescript**：TypeScript 编译器
- **vue-tsc**：Vue TypeScript 类型检查器

## 项目结构

```
mood-health-web/
├── public/                     # 静态资源目录
│   ├── audio/                 # 音频文件
│   │   └── effects/         # 音效文件
│   └── vite.svg             # Vite 图标
├── src/                       # 源代码目录
│   ├── assets/               # 资源文件
│   │   └── styles/          # 样式文件
│   │       ├── theme.scss    # 主题样式
│   │       └── variables.scss # 样式变量
│   ├── components/           # 组件目录
│   │   ├── SubNav.vue       # 子导航组件
│   │   ├── treehole/        # 树洞相关组件
│   │   │   ├── CommentList.vue # 评论列表组件
│   │   │   ├── PostCard.vue    # 帖子卡片组件
│   │   │   └── PostForm.vue    # 发布表单组件
│   │   └── ...             # 其他组件
│   ├── composables/          # 组合式函数
│   │   ├── usePosts.ts      # 帖子相关逻辑
│   │   └── ...             # 其他组合式函数
│   ├── layouts/             # 布局组件
│   │   ├── MoodLayout.vue   # 情绪模块布局
│   │   ├── UserLayout.vue   # 用户模块布局
│   │   ├── RelaxLayout.vue  # 放松模块布局
│   │   └── ImproveLayout.vue # 改善模块布局
│   ├── router/              # 路由配置
│   │   └── index.ts        # 路由定义
│   ├── stores/              # 状态管理
│   │   ├── user.ts         # 用户状态
│   │   ├── relaxStore.ts   # 放松状态
│   │   └── ...            # 其他状态
│   ├── utils/               # 工具函数
│   │   ├── dateUtil.ts     # 日期工具
│   │   ├── request.ts      # HTTP 请求工具
│   │   ├── storageUtil.ts  # 存储工具
│   │   ├── debounce.ts     # 防抖节流工具
│   │   ├── activityStatus.ts # 活动状态工具
│   │   ├── sound.ts       # 音效工具
│   │   ├── validation.ts   # 表单验证工具
│   │   └── index.ts       # 工具函数统一入口
│   ├── views/               # 页面组件
│   │   ├── Login.vue       # 登录页面
│   │   ├── Register.vue    # 注册页面
│   │   ├── mood/          # 情绪相关页面
│   │   │   ├── MoodRecord.vue    # 情绪记录页面
│   │   │   ├── MoodAnalysis.vue  # 情绪分析页面
│   │   │   ├── MoodArchive.vue   # 情绪历史页面
│   │   │   └── ...              # 其他情绪页面
│   │   ├── improve/        # 改善相关页面
│   │   │   ├── Survey.vue        # 问卷页面
│   │   │   ├── Questionnaire.vue  # 问卷详情页面
│   │   │   ├── QuestionnaireList.vue # 问卷列表页面
│   │   │   ├── QuestionnaireHistory.vue # 问卷历史页面
│   │   │   ├── QuestionnaireResult.vue # 问卷结果页面
│   │   │   ├── Courses.vue       # 课程页面
│   │   │   ├── CourseDetail.vue  # 课程详情页面
│   │   │   ├── Knowledge.vue     # 知识页面
│   │   │   └── ...             # 其他改善页面
│   │   ├── relax/         # 放松相关页面
│   │   │   ├── RelaxCenter.vue  # 放松中心页面
│   │   │   ├── MusicTherapy.vue # 音乐治疗页面
│   │   │   ├── RelaxHistory.vue  # 放松历史页面
│   │   │   └── ...             # 其他放松页面
│   │   ├── treehole/      # 树洞相关页面
│   │   │   ├── TreeHole.vue      # 树洞页面
│   │   │   ├── TreeHoleDetail.vue # 树洞详情页面
│   │   │   ├── TreeHoleAudit.vue  # 树洞审核页面
│   │   │   └── ...              # 其他树洞页面
│   │   ├── activity/      # 活动相关页面
│   │   │   ├── GroupActivity.vue  # 团体活动页面
│   │   │   ├── ActivityDetail.vue # 活动详情页面
│   │   │   └── ...              # 其他活动页面
│   │   ├── Profile.vue     # 个人中心页面
│   │   ├── Setting.vue     # 设置页面
│   │   ├── Achievements.vue # 成就页面
│   │   ├── GuidePage.vue   # 引导页面
│   │   └── ...            # 其他页面
│   ├── App.vue              # 根组件
│   └── main.ts             # 应用入口
├── dist/                      # 编译输出目录
├── node_modules/              # 依赖包目录
├── .env                       # 环境变量配置
├── .gitignore                 # Git 忽略文件
├── index.html                 # HTML 模板
├── package.json               # 项目配置和依赖
├── tsconfig.json             # TypeScript 配置
├── tsconfig.node.json        # Node TypeScript 配置
├── vite.config.ts           # Vite 配置
└── README.md                # 项目说明文档
```

## 环境配置

在项目根目录创建 `.env` 文件，配置以下环境变量：

```env
# API 配置
VITE_API_BASE_URL=http://localhost:3000

# 应用配置
VITE_APP_TITLE=大学生情绪健康系统
VITE_APP_VERSION=1.0.0

# 其他配置
VITE_ENABLE_MOCK=false
```

## 安装依赖

```bash
# 安装项目依赖
npm install

# 或使用 yarn
yarn install

# 或使用 pnpm
pnpm install
```

## 启动命令

### 开发环境

```bash
# 启动开发服务器（支持热重载）
npm run dev

# 或使用 yarn
yarn dev

# 或使用 pnpm
pnpm dev
```

### 生产环境

```bash
# 编译生产版本
npm run build

# 预览生产版本
npm run preview

# 或使用 yarn
yarn build
yarn preview

# 或使用 pnpm
pnpm build
pnpm preview
```

### 其他命令

```bash
# 运行 TypeScript 类型检查
npm run type-check

# 或使用 yarn
yarn type-check

# 或使用 pnpm
pnpm type-check
```

## 主要功能模块

### 1. 情绪管理模块

- **情绪记录**：记录当前情绪状态和心情描述
- **情绪分析**：通过图表展示情绪变化趋势
- **情绪历史**：查看历史情绪记录

### 2. 心理评估模块

- **问卷列表**：浏览可用的心理评估问卷
- **问卷填写**：在线完成心理评估问卷
- **结果分析**：查看问卷结果和建议
- **历史记录**：查看历史评估记录

### 3. 放松训练模块

- **音乐治疗**：播放放松音乐，缓解压力
- **放松历史**：查看放松训练记录
- **放松中心**：综合放松训练入口

### 4. 课程学习模块

- **课程列表**：浏览心理健康相关课程
- **课程详情**：查看课程详细内容
- **知识库**：心理健康知识文章

### 5. 活动管理模块

- **活动列表**：浏览团体心理活动
- **活动详情**：查看活动详细信息
- **活动报名**：参与团体活动

### 6. 树洞功能模块

- **匿名发布**：匿名发布心情和想法
- **评论互动**：与其他用户互动交流
- **内容审核**：管理员审核发布内容

### 7. 个人中心模块

- **个人信息**：查看和编辑个人信息
- **成就系统**：查看个人成就和进度
- **设置**：应用设置和偏好

## 工具函数说明

### 日期工具 (dateUtil.ts)

提供日期格式化、时间计算等功能

```typescript
import { formatDate, formatTime } from '@/utils/dateUtil';

// 格式化日期
const dateStr = formatDate(new Date()); // 返回 "2026-03-15"

// 格式化时间
const timeStr = formatTime(new Date()); // 返回 "13:30:00"
```

### 请求工具 (request.ts)

封装 Axios 请求，提供统一的 API 调用接口

```typescript
import request from '@/utils/request';

// GET 请求
const data = await request.get('/api/user');

// POST 请求
const result = await request.post('/api/auth/login', { username, password });
```

### 存储工具 (storageUtil.ts)

提供本地存储的封装接口

```typescript
import { setStorage, getStorage, removeStorage } from '@/utils/storageUtil';

// 设置存储
setStorage('token', 'your_token_here');

// 获取存储
const token = getStorage('token');

// 删除存储
removeStorage('token');
```

### 表单验证工具 (validation.ts)

提供常用的表单数据验证功能

```typescript
import { isValidEmail, isValidPhone, getPasswordStrength } from '@/utils/validation';

// 验证邮箱
const isValid = isValidEmail('test@example.com');

// 验证手机号
const isPhoneValid = isValidPhone('13800138000');

// 检查密码强度
const strength = getPasswordStrength('password123'); // 返回 'weak', 'medium', 'strong'
```

### 防抖节流工具 (debounce.ts)

提供防抖和节流功能

```typescript
import { debounce, throttle } from '@/utils/debounce';

// 防抖函数
const debouncedFn = debounce(() => {
  console.log('防抖执行');
}, 300);

// 节流函数
const throttledFn = throttle(() => {
  console.log('节流执行');
}, 300);
```

## 组件开发规范

### 组件命名

- 使用 PascalCase 命名组件文件
- 组件名称应该具有描述性
- 避免使用过于简短的名称

### 组件结构

```vue
<template>
  <!-- 模板内容 -->
</template>

<script setup lang="ts">
// 导入依赖
import { ref, computed } from 'vue';

// 定义组件属性
const props = defineProps<{
  title: string;
}>();

// 定义组件事件
const emit = defineEmits<{
  (e: 'update', value: string): void;
}>();

// 响应式数据
const count = ref(0);

// 计算属性
const doubled = computed(() => count.value * 2);

// 方法
const increment = () => {
  count.value++;
  emit('update', count.value);
};
</script>

<style scoped>
/* 组件样式 */
</style>
```

### 组合式函数

```typescript
import { ref, computed } from 'vue';

export function useCounter(initialValue = 0) {
  const count = ref(initialValue);
  
  const increment = () => {
    count.value++;
  };
  
  const decrement = () => {
    count.value--;
  };
  
  const doubled = computed(() => count.value * 2);
  
  return {
    count,
    increment,
    decrement,
    doubled
  };
}
```

## 状态管理

### Pinia Store

```typescript
import { defineStore } from 'pinia';

export const useUserStore = defineStore('user', () => {
  const user = ref(null);
  const token = ref('');
  
  const login = (userData: any) => {
    user.value = userData;
    token.value = userData.token;
  };
  
  const logout = () => {
    user.value = null;
    token.value = '';
  };
  
  return {
    user,
    token,
    login,
    logout
  };
});
```

## 路由配置

### 路由定义

```typescript
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: () => import('@/views/Home.vue')
    },
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/Login.vue')
    }
  ]
});

export default router;
```

## 样式开发

### SCSS 变量

```scss
// 主题色
$primary-color: #4CAF50;
$secondary-color: #2196F3;
$accent-color: #FF9800;

// 文字颜色
$text-primary: #333333;
$text-secondary: #666666;
$text-disabled: #999999;

// 背景颜色
$bg-primary: #ffffff;
$bg-secondary: #f5f5f5;
$bg-disabled: #e0e0e0;
```

### 响应式设计

```scss
// 移动端
@media (max-width: 768px) {
  .container {
    padding: 10px;
  }
}

// 平板端
@media (min-width: 769px) and (max-width: 1024px) {
  .container {
    padding: 20px;
  }
}

// 桌面端
@media (min-width: 1025px) {
  .container {
    padding: 30px;
  }
}
```

## 开发规范

### 代码风格

- 使用 TypeScript 进行类型定义
- 遵循 ESLint 代码规范
- 使用 Prettier 进行代码格式化
- 组件使用 Composition API
- 添加完整的 JSDoc 注释

### Git 提交规范

- `feat`：新功能
- `fix`：修复 bug
- `docs`：文档更新
- `style`：代码格式调整
- `refactor`：代码重构
- `test`：测试相关
- `chore`：构建过程或辅助工具的变动

### 分支管理

- `main`：主分支，用于生产环境
- `develop`：开发分支
- `feature/*`：功能分支
- `bugfix/*`：修复分支

## 部署说明

### 生产环境部署

1. 设置环境变量
2. 安装依赖：`npm install --production`
3. 编译代码：`npm run build`
4. 部署 `dist` 目录到静态服务器

### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Docker 部署（如果有 Dockerfile）

```bash
# 构建镜像
docker build -t mood-health-web .

# 运行容器
docker run -p 80:80 --env-file .env mood-health-web
```

## 常见问题

### 开发服务器启动失败

检查端口是否被占用，可以使用其他端口启动：

```bash
npm run dev -- --port 3002
```

### API 请求失败

检查 `.env` 文件中的 `VITE_API_BASE_URL` 是否正确配置，确保后端服务正在运行。

### 样式不生效

检查 SCSS 变量是否正确导入，确保样式文件路径正确。

## 性能优化

### 代码分割

使用动态导入进行路由级别的代码分割：

```typescript
const routes = [
  {
    path: '/home',
    component: () => import('@/views/Home.vue')
  }
];
```

### 图片优化

使用适当的图片格式和尺寸，压缩图片文件。

### 缓存策略

合理使用浏览器缓存和 HTTP 缓存头。

## 浏览器兼容性

- Chrome >= 90
- Firefox >= 88
- Safari >= 14
- Edge >= 90

## 贡献指南

欢迎提交 Issue 和 Pull Request 来改进项目。

## 许可证

本项目采用 MIT 许可证。

## 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 Issue
- 发送邮件至项目维护者

---

**注意**：本系统仅供学习和研究使用，请勿用于商业用途。



# **大学生情绪健康系统 - 后端服务**

# 项目介绍

大学生情绪健康系统后端服务是一个基于 Node.js + TypeScript + Express 的 RESTful API 服务，为前端应用提供完整的数据支持和业务逻辑处理。系统采用前后端分离架构，专注于为大学生提供情绪管理、心理评估、放松训练等功能的后端支持。

### 主要功能

- **用户认证**：用户注册、登录、JWT 认证
- **情绪管理**：情绪记录、情绪分析、情绪历史
- **心理评估**：问卷管理、问卷填写、结果分析
- **放松训练**：音乐治疗、放松历史记录
- **课程学习**：心理健康课程、课程详情
- **活动管理**：团体活动、活动详情、活动报名
- **树洞功能**：匿名发布、评论互动、内容审核
- **数据缓存**：Redis 缓存支持，提升系统性能
- **错误处理**：完整的全局错误处理系统
- **日志记录**：Winston 日志系统，支持多级别日志

## 技术栈

### 核心技术

- **Node.js**：JavaScript 运行时环境
- **TypeScript**：JavaScript 的超集，提供静态类型检查
- **Express**：Node.js Web 应用框架

### 数据库

- **SQL Server**：关系型数据库，存储业务数据
- **Redis**：内存数据库，用于缓存和会话管理

### 主要依赖

- **mssql**：SQL Server 驱动
- **ioredis**：Redis 客户端
- **jsonwebtoken**：JWT 认证
- **bcryptjs**：密码加密
- **express-validator**：请求参数验证
- **winston**：日志管理
- **helmet**：安全头设置
- **cors**：跨域资源共享
- **morgan**：HTTP 请求日志

### 开发工具

- **nodemon**：开发环境自动重启
- **ts-node**：直接运行 TypeScript 文件
- **typescript**：TypeScript 编译器

## 项目结构

```
mood-health-server/
├── src/                          # 源代码目录
│   ├── config/                   # 配置文件
│   │   └── database.ts          # 数据库连接配置
│   ├── controllers/              # 控制器层
│   │   ├── activityController.ts  # 活动相关控制器
│   │   ├── authController.ts     # 认证相关控制器
│   │   ├── courseController.ts   # 课程相关控制器
│   │   ├── moodController.ts     # 情绪相关控制器
│   │   ├── musicController.ts    # 音乐相关控制器
│   │   ├── postController.ts     # 树洞相关控制器
│   │   └── questionnaireController.ts # 问卷相关控制器
│   ├── middleware/               # 中间件
│   │   ├── auth.ts             # JWT 认证中间件
│   │   ├── errorHandler.ts      # 全局错误处理中间件
│   │   └── validateRequest.ts  # 请求验证中间件
│   ├── models/                  # 数据模型
│   │   ├── activityModel.ts     # 活动数据模型
│   │   ├── adviceModel.ts       # 建议数据模型
│   │   ├── commentModel.ts      # 评论数据模型
│   │   ├── courseModel.ts      # 课程数据模型
│   │   ├── moodModel.ts        # 情绪数据模型
│   │   ├── musicModel.ts       # 音乐数据模型
│   │   ├── postModel.ts        # 树洞数据模型
│   │   ├── questionnaireModel.ts # 问卷数据模型
│   │   └── userModel.ts        # 用户数据模型
│   ├── routes/                  # 路由定义
│   │   ├── activityRoutes.ts    # 活动相关路由
│   │   ├── authRoutes.ts       # 认证相关路由
│   │   ├── courseRoutes.ts     # 课程相关路由
│   │   ├── moodRoutes.ts       # 情绪相关路由
│   │   ├── musicRoutes.ts      # 音乐相关路由
│   │   ├── postRoutes.ts      # 树洞相关路由
│   │   └── questionnaireRoutes.ts # 问卷相关路由
│   ├── scripts/                 # 数据库脚本
│   │   ├── createAssessmentTables.ts # 创建评估表
│   │   ├── createCourseTable.ts     # 创建课程表
│   │   ├── createLikeTables.ts      # 创建点赞表
│   │   ├── createMoodRelationTables.ts # 创建情绪关联表
│   │   ├── createMusicTable.ts      # 创建音乐表
│   │   ├── createQuestionnaireTables.ts # 创建问卷表
│   │   ├── createTreeHoleTables.ts # 创建树洞表
│   │   ├── initDb.ts              # 初始化数据库
│   │   ├── seedActivities.ts      # 活动数据种子
│   │   ├── seedQuestionnaires.ts   # 问卷数据种子
│   │   └── setAdmin.ts           # 设置管理员
│   ├── types/                   # TypeScript 类型定义
│   │   └── express.d.ts        # Express 类型扩展
│   ├── utils/                   # 工具函数
│   │   ├── cache.ts            # 缓存工具
│   │   ├── contentFilter.ts     # 内容过滤工具
│   │   ├── encryption.ts        # 加密工具
│   │   ├── errors.ts           # 自定义错误类
│   │   ├── index.ts            # 工具函数统一入口
│   │   ├── logger.ts          # 日志工具
│   │   ├── password.ts        # 密码工具
│   │   ├── redis.client.ts     # Redis 客户端
│   │   └── redisClient.ts     # Redis 客户端（旧版）
│   ├── app.ts                  # Express 应用配置
│   └── server.ts              # 服务器入口文件
├── dist/                       # 编译输出目录
├── logs/                       # 日志文件目录
│   ├── error.log              # 错误日志
│   └── combined.log          # 综合日志
├── node_modules/              # 依赖包目录
├── .env                       # 环境变量配置
├── .gitignore                 # Git 忽略文件
├── package.json               # 项目配置和依赖
├── tsconfig.json             # TypeScript 配置
└── README.md                 # 项目说明文档
```

## 环境配置

在项目根目录创建 `.env` 文件，配置以下环境变量：

```env
# 服务器配置
PORT=3000
NODE_ENV=development

# 数据库配置
DB_SERVER=localhost
DB_PORT=1433
DB_NAME=mood_health
DB_USER=your_username
DB_PASSWORD=your_password

# Redis 配置
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT 配置
JWT_SECRET=your_jwt_secret_key_here

# API 配置
API_BASE_URL=http://localhost:3000
```

## 安装依赖

```bash
# 安装项目依赖
npm install

# 或使用 yarn
yarn install

# 或使用 pnpm
pnpm install
```

## 启动命令

### 开发环境

```bash
# 启动开发服务器（支持热重载）
npm run dev

# 或使用 yarn
yarn dev

# 或使用 pnpm
pnpm dev
```

### 生产环境

```bash
# 编译 TypeScript 代码
npm run build

# 启动生产服务器
npm start

# 或使用 yarn
yarn build
yarn start

# 或使用 pnpm
pnpm build
pnpm start
```

### 其他命令

```bash
# 运行 TypeScript 编译检查
npm run build

# 运行测试（如果有）
npm test

# 代码格式化（如果有配置）
npm run format

# 代码检查（如果有配置）
npm run lint
```

## API 接口文档

### 认证接口

#### 用户注册

- **接口**：`POST /api/auth/register`

- **描述**：创建新用户账号

- **请求体**：

  ```json
  {
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }
  ```

- **响应**：

  ```json
  {
    "code": 0,
    "message": "注册成功"
  }
  ```

#### 用户登录

- **接口**：`POST /api/auth/login`

- **描述**：用户登录并获取访问令牌

- **请求体**：

  ```json
  {
    "username": "testuser",
    "password": "password123"
  }
  ```

- **响应**：

  ```json
  {
    "code": 0,
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIs...",
      "user": {
        "id": 1,
        "username": "testuser",
        "email": "test@example.com"
      }
    }
  }
  ```

#### 获取用户信息

- **接口**：`GET /api/auth/me`

- **描述**：获取当前登录用户的详细信息

- **请求头**：

  ```
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
  ```

- **响应**：

  ```json
  {
    "code": 0,
    "data": {
      "user": {
        "id": 1,
        "username": "testuser",
        "email": "test@example.com",
        "role": "user"
      }
    }
  }
  ```

### 健康检查

#### 系统健康检查

- **接口**：`GET /health`

- **描述**：检查系统各组件的健康状态

- **响应**：

  ```json
  {
    "status": "ok",
    "database": "connected",
    "redis": "connected",
    "result": [
      {
        "result": 2
      }
    ]
  }
  ```

## 错误处理

系统实现了完整的全局错误处理机制，统一错误返回格式：

```json
{
  "code": 400,
  "message": "用户名已存在",
  "data": null,
  "path": "/api/auth/register",
  "timestamp": "2026-03-15T13:30:00.000Z"
}
```

### 错误类型

- **400**：请求参数错误
- **401**：未授权或认证失败
- **404**：资源不存在
- **500**：服务器内部错误

## 开发规范

### 代码风格

- 使用 TypeScript 进行类型定义
- 遵循 ESLint 代码规范
- 使用 Prettier 进行代码格式化
- 添加完整的 JSDoc 注释

### Git 提交规范

- `feat`：新功能
- `fix`：修复 bug
- `docs`：文档更新
- `style`：代码格式调整
- `refactor`：代码重构
- `test`：测试相关
- `chore`：构建过程或辅助工具的变动

### 分支管理

- `main`：主分支，用于生产环境
- `develop`：开发分支
- `feature/*`：功能分支
- `bugfix/*`：修复分支

## 部署说明

### 生产环境部署

1. 设置环境变量
2. 安装依赖：`npm install --production`
3. 编译代码：`npm run build`
4. 启动服务：`npm start`

### Docker 部署（如果有 Dockerfile）

```bash
# 构建镜像
docker build -t mood-health-server .

# 运行容器
docker run -p 3000:3000 --env-file .env mood-health-server
```

## 常见问题

### 数据库连接失败

检查 `.env` 文件中的数据库配置是否正确，确保 SQL Server 服务正在运行。

### Redis 连接失败

检查 `.env` 文件中的 Redis 配置是否正确，确保 Redis 服务正在运行。

### JWT 认证失败

检查 `.env` 文件中的 `JWT_SECRET` 是否设置，确保客户端正确传递了 `Authorization` 头。

## 贡献指南

欢迎提交 Issue 和 Pull Request 来改进项目。

## 许可证

本项目采用 MIT 许可证。

## 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 Issue
- 发送邮件至项目维护者

------

**注意**：本系统仅供学习和研究使用，请勿用于商业用途。