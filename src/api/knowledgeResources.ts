import request from '@/utils/request'

export type KnowledgeResourceType = 'article' | 'document' | 'link' | 'video'
export type KnowledgeIngestionStatus = 'pending' | 'processing' | 'ready' | 'failed'

export interface KnowledgeFolder {
  id: number
  slug: string
  name: string
  description: string | null
  isBuiltin: boolean
  ownerUserId: number | null
  createdAt: string
  updatedAt: string
}

export interface KnowledgeResource {
  id: number
  folderId: number
  folderSlug: string
  title: string
  summary: string
  resourceType: KnowledgeResourceType
  sourceUrl: string | null
  downloadUrl: string | null
  licenseCode: string
  isBuiltin: boolean
  ingestionStatus: KnowledgeIngestionStatus
  reviewedAt: string | null
  favorited: boolean
  createdAt: string
  updatedAt: string
}

export interface KnowledgeResourcePage {
  items: KnowledgeResource[]
  total: number
  page: number
  pageSize: number
}

export interface KnowledgeResourceQuery {
  folderId?: number
  search?: string
  page?: number
  pageSize?: number
}

export const getKnowledgeFolders = () =>
  request<KnowledgeFolder[]>({
    url: '/api/knowledge-resources/folders',
    method: 'get',
  })

export const getKnowledgeResources = (params: KnowledgeResourceQuery = {}) =>
  request<KnowledgeResourcePage>({
    url: '/api/knowledge-resources',
    method: 'get',
    params,
  })

export const getKnowledgeResource = (id: number) =>
  request<KnowledgeResource>({
    url: `/api/knowledge-resources/${id}`,
    method: 'get',
  })

export const setKnowledgeResourceFavorite = (id: number, favorite: boolean) =>
  request<{ favorite: boolean }>({
    url: `/api/knowledge-resources/${id}/favorite`,
    method: 'post',
    data: { favorite },
  })

export interface UploadKnowledgeResourceInput {
  title: string
  summary: string
  licenseCode?: string
  file: File
}

export const uploadKnowledgeResource = (input: UploadKnowledgeResourceInput) => {
  const data = new FormData()
  data.append('title', input.title)
  data.append('summary', input.summary)
  if (input.licenseCode) data.append('licenseCode', input.licenseCode)
  data.append('file', input.file)

  return request<KnowledgeResource>({
    url: '/api/knowledge-resources/upload',
    method: 'post',
    data,
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
