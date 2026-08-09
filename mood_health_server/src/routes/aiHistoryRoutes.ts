/**
 * AI 分析历史路由
 * 提供 AI 分析记录的保存、列表和详情接口
 */

import express from 'express'
import { authenticate } from '../middleware/auth'
import { saveHistory, listHistory, getHistoryDetail } from '../controllers/aiHistoryController'

const router = express.Router()

router.use(authenticate)

/**
 * 保存 AI 分析记录
 * @route POST /api/ai/history
 */
router.post('/history', saveHistory)

/**
 * 获取 AI 分析历史列表
 * @route GET /api/ai/history
 */
router.get('/history', listHistory)

/**
 * 获取 AI 分析历史详情
 * @route GET /api/ai/history/:id
 */
router.get('/history/:id', getHistoryDetail)

export default router