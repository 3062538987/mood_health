import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getMysqlPool } from '../config/mysql'

export type KnowledgeResourceType = 'article' | 'document' | 'link' | 'video'
export type KnowledgeIngestionStatus = 'pending' | 'processing' | 'ready' | 'failed'

export interface KnowledgeFolderDto {
  id: number
  slug: string
  name: string
  description: string | null
  isBuiltin: boolean
  ownerUserId: number | null
  createdAt: string
  updatedAt: string
}

export interface KnowledgeResourceDto {
  id: number
  folderId: number
  folderSlug: string
  title: string
  summary: string
  resourceType: KnowledgeResourceType
  sourceUrl: string | null
  licenseCode: string
  isBuiltin: boolean
  ingestionStatus: KnowledgeIngestionStatus
  reviewedAt: string | null
  favorited: boolean
  createdAt: string
  updatedAt: string
}

export interface ListKnowledgeResourcesInput {
  userId: number
  page: number
  pageSize: number
  folderId?: number
  search?: string
}

export interface KnowledgeResourcePage {
  items: KnowledgeResourceDto[]
  total: number
  page: number
  pageSize: number
}

export interface KnowledgeResourceDatabase {
  query<T>(sql: string, params?: unknown[]): Promise<[T, unknown]>
}

type FolderRow = RowDataPacket & {
  id: number
  slug: string
  name: string
  description: string | null
  is_builtin: number | boolean
  owner_user_id: number | null
  created_at: Date | string
  updated_at: Date | string
}

type ResourceRow = RowDataPacket & {
  id: number
  folder_id: number
  folder_slug: string
  title: string
  summary: string
  resource_type: string
  source_url: string | null
  license_code: string
  is_builtin: number | boolean
  ingestion_status: string
  reviewed_at: Date | string | null
  favorited: number | boolean
  created_at: Date | string
  updated_at: Date | string
}

type CountRow = RowDataPacket & { total: number | string }

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : String(value)

const toDateString = (value: Date | string | null): string | null => {
  if (value === null) return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

const mapFolder = (row: FolderRow): KnowledgeFolderDto => ({
  id: Number(row.id),
  slug: row.slug,
  name: row.name,
  description: row.description,
  isBuiltin: Boolean(row.is_builtin),
  ownerUserId: row.owner_user_id === null ? null : Number(row.owner_user_id),
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
})

const mapResource = (row: ResourceRow): KnowledgeResourceDto => ({
  id: Number(row.id),
  folderId: Number(row.folder_id),
  folderSlug: row.folder_slug,
  title: row.title,
  summary: row.summary,
  resourceType: row.resource_type as KnowledgeResourceType,
  sourceUrl: row.source_url,
  licenseCode: row.license_code,
  isBuiltin: Boolean(row.is_builtin),
  ingestionStatus: row.ingestion_status as KnowledgeIngestionStatus,
  reviewedAt: toDateString(row.reviewed_at),
  favorited: Boolean(row.favorited),
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
})

const RESOURCE_SELECT = `
  SELECT r.id, r.folder_id, f.slug AS folder_slug, r.title, r.summary, r.resource_type,
         r.source_url, r.license_code, r.is_builtin, r.ingestion_status, r.reviewed_at,
         EXISTS(
           SELECT 1 FROM knowledge_favorites favorite
           WHERE favorite.user_id = ? AND favorite.resource_id = r.id
         ) AS favorited,
         r.created_at, r.updated_at
  FROM knowledge_resources r
  INNER JOIN knowledge_folders f ON f.id = r.folder_id`

export const createKnowledgeResourceRepository = (
  db: KnowledgeResourceDatabase = getMysqlPool()
) => {
  const listFolders = async (_userId: number): Promise<KnowledgeFolderDto[]> => {
    const [rows] = await db.query<FolderRow[]>(
      'SELECT * FROM knowledge_folders ORDER BY is_builtin DESC, name ASC, id ASC'
    )
    return rows.map(mapFolder)
  }

  const listResources = async (
    input: ListKnowledgeResourcesInput
  ): Promise<KnowledgeResourcePage> => {
    const conditions = ['r.is_active = 1']
    const filterParams: unknown[] = []
    if (input.folderId !== undefined) {
      conditions.push('r.folder_id = ?')
      filterParams.push(input.folderId)
    }
    if (input.search) {
      conditions.push('(r.title LIKE ? OR r.summary LIKE ?)')
      const pattern = `%${input.search}%`
      filterParams.push(pattern, pattern)
    }

    const whereSql = ` WHERE ${conditions.join(' AND ')}`
    const [countRows] = await db.query<CountRow[]>(
      `SELECT COUNT(*) AS total FROM knowledge_resources r${whereSql}`,
      filterParams
    )
    const offset = (input.page - 1) * input.pageSize
    const [rows] = await db.query<ResourceRow[]>(
      `${RESOURCE_SELECT}${whereSql} ORDER BY r.is_builtin DESC, r.created_at DESC, r.id DESC LIMIT ? OFFSET ?`,
      [input.userId, ...filterParams, input.pageSize, offset]
    )

    return {
      items: rows.map(mapResource),
      total: Number(countRows[0]?.total ?? 0),
      page: input.page,
      pageSize: input.pageSize,
    }
  }

  const findById = async (
    resourceId: number,
    userId: number
  ): Promise<KnowledgeResourceDto | null> => {
    const [rows] = await db.query<ResourceRow[]>(
      `${RESOURCE_SELECT} WHERE r.id = ? AND r.is_active = 1 LIMIT 1`,
      [userId, resourceId]
    )
    return rows[0] ? mapResource(rows[0]) : null
  }

  const setFavorite = async (
    userId: number,
    resourceId: number,
    favorite: boolean
  ): Promise<boolean> => {
    if (favorite) {
      await db.query<ResultSetHeader>(
        `INSERT INTO knowledge_favorites (user_id, resource_id, created_at)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE created_at = created_at`,
        [userId, resourceId, new Date()]
      )
      return true
    }

    await db.query<ResultSetHeader>(
      'DELETE FROM knowledge_favorites WHERE user_id = ? AND resource_id = ?',
      [userId, resourceId]
    )
    return false
  }

  return { listFolders, listResources, findById, setFavorite }
}

export type KnowledgeResourceRepository = ReturnType<typeof createKnowledgeResourceRepository>
