import { createHash } from 'node:crypto'
import path from 'node:path'

export const MAX_KNOWLEDGE_UPLOAD_BYTES = 10 * 1024 * 1024

export interface KnowledgeUploadFile {
  fieldname: string
  originalname: string
  encoding: string
  mimetype: string
  size: number
  buffer: Buffer
}

export class KnowledgeUploadValidationError extends Error {
  readonly code = 'BAD_REQUEST'
  readonly statusCode = 400

  constructor(message: string) {
    super(message)
    this.name = 'KnowledgeUploadValidationError'
  }
}

interface ValidatedKnowledgeUpload {
  extension: '.pdf' | '.docx' | '.txt'
  normalizedMimeType: string
  contentHash: string
}

const isPdf = (buffer: Buffer): boolean =>
  buffer.length >= 5 && buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))

const isDocx = (buffer: Buffer): boolean =>
  buffer.length >= 4 &&
  buffer[0] === 0x50 &&
  buffer[1] === 0x4b &&
  buffer[2] === 0x03 &&
  buffer[3] === 0x04

const isUtf8Text = (buffer: Buffer): boolean => {
  if (buffer.includes(0)) return false
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    return true
  } catch {
    return false
  }
}

export const validateKnowledgeUpload = (
  file: KnowledgeUploadFile
): ValidatedKnowledgeUpload => {
  if (file.size > MAX_KNOWLEDGE_UPLOAD_BYTES) {
    throw new KnowledgeUploadValidationError('文件大小不能超过 10MB')
  }
  if (file.size <= 0 || file.buffer.length === 0) {
    throw new KnowledgeUploadValidationError('上传文件不能为空')
  }

  const extension = path.extname(file.originalname).toLowerCase()
  const typeRules = {
    'application/pdf': { extension: '.pdf', valid: isPdf(file.buffer) },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
      extension: '.docx',
      valid: isDocx(file.buffer),
    },
    'text/plain': { extension: '.txt', valid: isUtf8Text(file.buffer) },
  } as const
  const rule = typeRules[file.mimetype as keyof typeof typeRules]

  if (!rule || !['.pdf', '.docx', '.txt'].includes(extension)) {
    throw new KnowledgeUploadValidationError('仅支持 PDF、DOCX 和 TXT 文件')
  }
  if (extension !== rule.extension || !rule.valid) {
    throw new KnowledgeUploadValidationError('文件内容与声明类型不一致')
  }

  return {
    extension: rule.extension,
    normalizedMimeType: file.mimetype,
    contentHash: createHash('sha256').update(file.buffer).digest('hex'),
  }
}
