#!/bin/bash

# wrk 压力测试脚本
# 安装 wrk: https://github.com/wg/wrk

# 配置参数
HOST="http://localhost:3000"
DURATION="60s"
THREADS=4
CONNECTIONS=100

echo "========================================="
echo "大学生情绪健康管理平台 - 压力测试"
echo "========================================="
echo "目标服务器: $HOST"
echo "测试时长: $DURATION"
echo "线程数: $THREADS"
echo "连接数: $CONNECTIONS"
echo "========================================="

# 测试 1: 获取情绪列表
echo -e "\n[测试 1] 获取情绪列表 - GET /api/moods"
wrk -t$THREADS -c$CONNECTIONS -d$DURATION \
    -H "Authorization: Bearer YOUR_TOKEN" \
    "$HOST/api/moods?page=1&pageSize=20"

# 测试 2: 创建情绪记录
echo -e "\n[测试 2] 创建情绪记录 - POST /api/moods"
wrk -t$THREADS -c$CONNECTIONS -d$DURATION \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -s scripts/create_mood.lua \
    "$HOST/api/moods"

# 测试 3: 获取情绪周报
echo -e "\n[测试 3] 获取情绪周报 - GET /api/moods/weekly-report"
wrk -t$THREADS -c$CONNECTIONS -d$DURATION \
    -H "Authorization: Bearer YOUR_TOKEN" \
    "$HOST/api/moods/weekly-report"

# 测试 4: 获取树洞帖子
echo -e "\n\n[测试 4] 获取树洞帖子 - GET /api/posts"
wrk -t$THREADS -c$CONNECTIONS -d$DURATION \
    -H "Authorization: Bearer YOUR_TOKEN" \
    "$HOST/api/posts?page=1&pageSize=20"

# 测试 5: AI 情绪分析
echo -e "\n[测试 5] AI 情绪分析 - POST /api/analyze-mood"
wrk -t$THREADS -c10 -d30s \
    -H "Content-Type: application/json" \
    -s scripts/analyze_mood.lua \
    "http://localhost:8000/api/analyze-mood"

echo -e "\n========================================="
echo "压力测试完成"
echo "========================================="
