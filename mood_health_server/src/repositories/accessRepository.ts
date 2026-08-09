import { RowDataPacket } from 'mysql2'
import { getMysqlPool } from '../config/mysql'
import { MysqlExecutor } from './userRepository'

type PermissionRow = RowDataPacket & {
  granted: number
}

export const createAccessRepository = (db: MysqlExecutor = getMysqlPool()) => {
  const hasPermission = async (roleCode: string, permissionCode: string): Promise<boolean> => {
    const [rows] = await db.query<PermissionRow[]>(
      `
      SELECT 1 AS granted
      FROM roles r
      JOIN role_permissions rp ON rp.role_id = r.id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE r.code = ?
        AND p.code = ?
      LIMIT 1
      `,
      [roleCode, permissionCode]
    )

    return rows.length > 0
  }

  return {
    hasPermission,
  }
}

export type AccessRepository = ReturnType<typeof createAccessRepository>
