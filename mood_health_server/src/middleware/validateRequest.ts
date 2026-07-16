import { validationResult } from 'express-validator'
import { Request, Response, NextFunction } from 'express'
import { API_ERROR_CODES, apiFailure } from '../utils/apiResponse'

export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg).join('; ')
    return res.status(400).json(
      apiFailure(API_ERROR_CODES.BAD_REQUEST, `参数验证失败: ${messages}`)
    )
  }
  next()
}