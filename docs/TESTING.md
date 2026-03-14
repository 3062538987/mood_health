# 测试指南

本文档描述了大学生情绪健康管理平台的测试方法和流程。

## 测试类型

1. **前端单元测试**：使用 Vitest 测试前端组件和函数
2. **后端压力测试**：使用 Locust 和 wrk 测试 API 性能

## 前端单元测试

### 安装依赖

```bash
cd mood-health-web
npm install
```

### 运行测试

```bash
# 运行所有测试
npm test

# 运行测试并打开 UI 界面
npm run test:ui

# 运行测试并生成覆盖率报告
npm run test:coverage
```

### 测试文件结构

```
mood-health-web/
├── src/
│   ├── __tests__/
│   │   ├── api/
│   │   │   └── mood.test.ts      # API 函数测试
│   │   └── components/           # 组件测试
│   └── api/
│       └── mood.ts               # 被测试的函数
└── vitest.config.ts              # Vitest 配置
```

### 测试示例

```typescript
import { describe, it, expect, vi } from 'vitest';
import { analyzeMood } from '@/api/mood';

describe('analyzeMood', () => {
  it('should return analysis result', async () => {
    const result = await analyzeMood({
      content: '今天心情很好',
      mood_level: 5,
    });

    expect(result).toHaveProperty('analysis');
    expect(result).toHaveProperty('suggestions');
  });
});
```

### 测试覆盖率

运行 `npm run test:coverage` 后，覆盖率报告会生成在 `coverage/` 目录。

打开 `coverage/index.html` 查看详细报告。

## 后端压力测试

### 使用 Locust

#### 安装 Locust

```bash
pip install locust
```

#### 运行测试

**Web UI 模式**：

```bash
cd mood-health-server
locust -f locustfile.py --host=http://localhost:3000
```

然后访问 http://localhost:8089，在 Web UI 中配置用户数和启动速率。

**命令行模式**：

```bash
# 测试 Node.js 后端（50 用户，运行 2 分钟）
locust -f locustfile.py --host=http://localhost:3000 \
    --headless -u 50 -r 5 -t 120s --only-summary

# 测试 AI 服务（10 用户，运行 1 分钟）
locust -f locustfile.py --host=http://localhost:8000 \
    --headless -u 10 -r 2 -t 60s --only-summary AIAnalysisUser
```

#### 测试场景

Locust 测试脚本包含以下用户行为：

**MoodHealthUser（Node.js 后端）**：
- 获取情绪列表（权重 10）
- 创建情绪记录（权重 5）
- 获取情绪周报（权重 3）
- 获取情绪趋势（权重 3）
- 更新情绪记录（权重 2）
- 删除情绪记录（权重 1）
- 获取树洞帖子（权重 5）
- 发布树洞帖子（权重 2）
- 获取活动列表（权重 3）
- 获取问卷列表（权重 2）

**AIAnalysisUser（AI 服务）**：
- AI 情绪分析（权重 10）
- 健康检查（权重 1）

### 使用 wrk

#### 安装 wrk

```bash
# Ubuntu/Debian
sudo apt-get install wrk

# macOS
brew install wrk

# Windows
# 从 https://github.com/wg/wrk/releases 下载
```

#### 运行测试

```bash
cd mood-health-server

# 给脚本添加执行权限
chmod +x scripts/stress_test.sh

# 运行测试（需要先替换 YOUR_TOKEN）
./scripts/stress_test.sh
```

#### 单独测试某个接口

```bash
# 测试获取情绪列表
wrk -t4 -c100 -d60s \
    -H "Authorization: Bearer YOUR_TOKEN" \
    "http://localhost:3000/api/moods?page=1&pageSize=20"

# 测试 AI 分析（使用 Lua 脚本）
wrk -t4 -c10 -d30s \
    -H "Content-Type: application/json" \
    -s scripts/analyze_mood.lua \
    "http://localhost:8000/api/analyze-mood"
```

### 性能指标

测试完成后，关注以下指标：

- **Requests/sec**：每秒处理的请求数
- **Latency**：请求响应时间（平均、中位数、P90、P99）
- **Error Rate**：错误率

### 性能基准

建议的性能基准：

| 接口 | 目标 RPS | 平均延迟 | P99 延迟 |
|------|----------|----------|----------|
| 获取情绪列表 | > 500 | < 100ms | < 300ms |
| 创建情绪记录 | > 200 | < 150ms | < 500ms |
| 获取情绪周报 | > 300 | < 100ms | < 300ms |
| AI 情绪分析 | > 10 | < 3s | < 5s |

## 测试最佳实践

### 单元测试

1. **隔离测试**：使用 mock 隔离外部依赖
2. **边界测试**：测试边界条件和异常情况
3. **描述性命名**：测试名称应清楚描述测试内容
4. **独立性**：每个测试应独立运行，不依赖其他测试

### 压力测试

1. **渐进加压**：从少量用户开始，逐步增加
2. **监控资源**：测试时监控服务器 CPU、内存、网络
3. **真实场景**：模拟真实的用户行为模式
4. **多次测试**：多次运行测试以获得稳定结果

## 持续集成

可以将测试集成到 CI/CD 流程中：

```yaml
# GitHub Actions 示例
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd mood-health-web
          npm install
      
      - name: Run unit tests
        run: |
          cd mood-health-web
          npm test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

## 故障排查

### 测试失败

1. 检查依赖是否正确安装
2. 检查测试环境配置
3. 查看错误日志定位问题

### 性能不达标

1. 检查数据库查询是否优化
2. 检查是否有 N+1 查询问题
3. 考虑添加缓存
4. 检查服务器资源配置

### AI 服务超时

1. 检查 Ollama 服务是否正常运行
2. 检查模型是否已加载
3. 考虑使用更快的模型
4. 增加 Redis 缓存命中率
