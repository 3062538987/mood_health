import path from 'node:path'
import {
  createKnowledgeResourceRepository,
  CreateUploadedKnowledgeResourceInput,
  KnowledgeResourceDto,
  KnowledgeResourceFileDto,
} from '../repositories/knowledgeResourceRepository'
import { createKnowledgeFileStore, KnowledgeFileStore } from './knowledgeFileStore'
import {
  KnowledgeUploadFile,
  validateKnowledgeUpload,
} from './knowledgeUploadPolicy'
import { KnowledgeResourceServiceError } from './knowledgeResourceService'

export interface KnowledgeUploadRepository {
  createUploadedResource(input: CreateUploadedKnowledgeResourceInput): Promise<KnowledgeResourceDto>
  findFileById(resourceId: number): Promise<KnowledgeResourceFileDto | null>
}

export interface KnowledgeUploadServiceDependencies {
  repository?: KnowledgeUploadRepository
  fileStore?: KnowledgeFileStore
}

const ALLOWED_UPLOAD_ROLES = new Set(['counselor', 'admin', 'super_admin'])

const requiredText = (value: unknown, field: string, maximum: number): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new KnowledgeResourceServiceError('BAD_REQUEST', 400, `${field}不能为空`)
  }
  const normalized = value.trim()
  if (normalized.length > maximum) {
    throw new KnowledgeResourceServiceError('BAD_REQUEST', 400, `${field}不能超过${maximum}个字符`)
  }
  return normalized
}

const normalizeResourceId = (value: number): number => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new KnowledgeResourceServiceError('BAD_REQUEST', 400, '资料参数无效')
  }
  return value
}

const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain; charset=utf-8',
}

export const createKnowledgeUploadService = (
  dependencies: KnowledgeUploadServiceDependencies = {}
) => {
  const repository = dependencies.repository ?? createKnowledgeResourceRepository()
  const fileStore = dependencies.fileStore ?? createKnowledgeFileStore()

  const upload = async (input: {
    userId: number
    role: string
    title: unknown
    summary: unknown
    licenseCode?: unknown
    file: KnowledgeUploadFile
  }): Promise<KnowledgeResourceDto> => {
    if (!ALLOWED_UPLOAD_ROLES.has(input.role)) {
      throw new KnowledgeResourceServiceError('FORBIDDEN', 403, '仅老师或管理员可以上传资料')
    }
    const ownerUserId = normalizeResourceId(input.userId)
    const title = requiredText(input.title, '资料标题', 200)
    const summary = requiredText(input.summary, '资料简介', 2000)
    const licenseCode =
      typeof input.licenseCode === 'string' && input.licenseCode.trim()
        ? requiredText(input.licenseCode, '授权信息', 80)
        : 'TEACHER_UPLOADED'
    const validated = validateKnowledgeUpload(input.file)
    const storageKey = await fileStore.save(input.file.buffer, validated.extension)

    try {
      return await repository.createUploadedResource({
        ownerUserId,
        folderSlug: `user-${ownerUserId}-uploads`,
        folderName: '老师上传资料',
        title,
        summary,
        storageKey,
        licenseCode,
        contentHash: validated.contentHash,
      })
    } catch (error) {
      await fileStore.remove(storageKey)
      throw error
    }
  }

  const getDownload = async (input: { resourceId: number }) => {
    const file = await repository.findFileById(normalizeResourceId(input.resourceId))
    if (!file) {
      throw new KnowledgeResourceServiceError('NOT_FOUND', 404, '请求的资料文件不存在')
    }
    const extension = path.extname(file.storageKey).toLowerCase()
    const safeTitle = file.title.replace(/[^\p{L}\p{N}._ -]+/gu, '_').slice(0, 120) || 'knowledge-resource'
    return {
      absolutePath: fileStore.resolve(file.storageKey),
      downloadName: `${safeTitle}${extension}`,
      mimeType: MIME_BY_EXTENSION[extension] || 'application/octet-stream',
    }
  }

  return { upload, getDownload }
}

export type KnowledgeUploadService = ReturnType<typeof createKnowledgeUploadService>
