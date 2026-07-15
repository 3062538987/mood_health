import dotenv from 'dotenv'
import type { Server } from 'http'
import { createApp } from './app'
import { connectDB } from './config/database'
import logger from './utils/logger'

dotenv.config()

export const startServer = async (): Promise<Server> => {
  const port = Number(process.env.PORT || 3000)
  const host = process.env.HOST || '127.0.0.1'

  await connectDB()

  return createApp().listen(port, host, () => {
    console.log(`🚀 服务器运行在 http://${host}:${port}`)
    console.log(`📊 健康检查: http://localhost:${port}/health`)
    console.log(`🔐 认证路由: http://localhost:${port}/api/auth`)
    console.log(`📋 问卷路由: http://localhost:${port}/api/questionnaires`)
  })
}

export const runServer = async () => {
  try {
    return await startServer()
  } catch (error) {
    logger.error('服务器启动失败', { error })
    process.exitCode = 1
    return undefined
  }
}

if (require.main === module) {
  void runServer()
}
