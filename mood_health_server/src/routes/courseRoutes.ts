import express from 'express'
import { getCourses, getCourseById } from '../controllers/courseController'

const router = express.Router()

// 公开路由
router.get('/', getCourses)
router.get('/:id', getCourseById)

// 课程写操作统一走 /api/admin/courses（managementRoutes），此处仅暴露公开浏览端点

export default router
