import { NextFunction, Request, Response } from 'express'
import multer from 'multer'
import { MAX_KNOWLEDGE_UPLOAD_BYTES } from '../services/knowledgeUploadPolicy'
import { apiFailure, businessCodeForHttpStatus } from '../utils/apiResponse'

const parser = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_KNOWLEDGE_UPLOAD_BYTES,
    files: 1,
    fields: 4,
    fieldNameSize: 80,
    fieldSize: 4096,
  },
})

export const parseKnowledgeUpload = (
  request: Request,
  response: Response,
  next: NextFunction
): void => {
  parser.single('file')(request, response, (error: unknown) => {
    if (!error) {
      next()
      return
    }

    const message =
      error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
        ? '文件大小不能超过 10MB'
        : '上传请求格式无效'
    response.status(400).json(apiFailure(businessCodeForHttpStatus(400), message))
  })
}
