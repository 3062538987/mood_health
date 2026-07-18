import { validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { API_ERROR_CODES } from '../utils/apiResponse';

const SENSITIVE_FIELDS = new Set([
  'password', 'newPassword', 'oldPassword', 'currentPassword', 'confirmPassword',
  'token', 'accessToken', 'refreshToken', 'secret', 'apiKey',
  'authorization', 'Authorization',
]);

export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const safeErrors = errors.array().map((err) => {
      const field = ('path' in err ? err.path : (err as any).param) as string;
      const isSensitive = SENSITIVE_FIELDS.has(field);
      return {
        field,
        message: err.msg as string,
        location: ('location' in err ? err.location : 'body') as string,
        ...(isSensitive ? {} : { value: ('value' in err ? err.value : undefined) }),
      };
    });

    return res.status(400).json({
      code: API_ERROR_CODES.BAD_REQUEST,
      message: '参数验证失败',
      data: { errors: safeErrors },
    });
  }
  next();
};