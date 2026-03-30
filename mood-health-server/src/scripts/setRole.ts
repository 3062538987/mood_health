import pool from '../config/database'
import sql from 'mssql'
import { isSqliteClient } from '../config/database'
import { connectSqlite, sqliteGet, sqliteRun, sqliteTransaction } from '../config/sqlite'

type AllowedRole = 'user' | 'admin' | 'super_admin'

const allowedRoles: AllowedRole[] = ['user', 'admin', 'super_admin']

interface ScriptArgs {
  username: string
  role: AllowedRole
  operator: string
}

const parseArgs = (): ScriptArgs | null => {
  const argv = process.argv.slice(2)
  const getFlagValue = (flag: string) => {
    const index = argv.indexOf(flag)
    if (index === -1 || index + 1 >= argv.length) {
      return undefined
    }
    return argv[index + 1]
  }

  // 兼容旧参数位置: <username> <role>
  const positionalUsername = argv[0] && !argv[0].startsWith('--') ? argv[0] : undefined
  const positionalRole = argv[1] && !argv[1].startsWith('--') ? argv[1] : undefined

  const username = getFlagValue('--username') || positionalUsername
  const roleInput = getFlagValue('--role') || positionalRole
  const operator = getFlagValue('--operator') || process.env.ROLE_OPERATOR_USERNAME

  if (!username || !roleInput || !operator) {
    return null
  }

  if (!allowedRoles.includes(roleInput as AllowedRole)) {
    return null
  }

  return {
    username,
    role: roleInput as AllowedRole,
    operator,
  }
}

const printUsage = () => {
  console.log('用法:')
  console.log(
    '  npx ts-node src/scripts/setRole.ts --username <name> --role <user|admin|super_admin> --operator <super_admin_username>'
  )
  console.log('  node dist/scripts/setRole.js --username <name> --role <user|admin|super_admin>')
  console.log('说明: 第二种方式需提前设置环境变量 ROLE_OPERATOR_USERNAME')
}

const ensureOperatorPermission = async (operator: string, tx: sql.Transaction) => {
  const result = await tx
    .request()
    .input('operator', sql.NVarChar, operator)
    .query('SELECT id, username, role FROM users WHERE username = @operator')

  if (result.recordset.length === 0) {
    throw new Error(`执行账号 ${operator} 不存在`)
  }

  const user = result.recordset[0]
  if (user.role !== 'super_admin') {
    throw new Error(`执行账号 ${operator} 权限不足，仅 super_admin 可执行`)
  }

  console.log(`✅ 执行账号校验通过: ${operator} (${user.role})`)
}

const ensureOperatorPermissionSqlite = (operator: string) => {
  const user = sqliteGet('SELECT id, username, role FROM users WHERE username = ? LIMIT 1', [
    operator,
  ]) as { id: number; username: string; role: string } | undefined

  if (!user) {
    throw new Error(`执行账号 ${operator} 不存在`)
  }

  if (user.role !== 'super_admin') {
    throw new Error(`执行账号 ${operator} 权限不足，仅 super_admin 可执行`)
  }

  console.log(`✅ 执行账号校验通过: ${operator} (${user.role})`)
}

const setRoleSqlite = (args: ScriptArgs) => {
  connectSqlite()
  console.log('✅ SQLite 数据库连接成功')

  sqliteTransaction(() => {
    ensureOperatorPermissionSqlite(args.operator)

    const user = sqliteGet('SELECT id, username, role FROM users WHERE username = ? LIMIT 1', [
      args.username,
    ]) as { id: number; username: string; role: string } | undefined

    if (!user) {
      throw new Error(`用户 ${args.username} 不存在`)
    }

    console.log(`找到目标用户: ${user.username}, 当前角色: ${user.role || 'user'}`)

    sqliteRun(
      `
        UPDATE users
        SET role = ?,
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `,
      [args.role, user.id]
    )
  })

  console.log(`✅ 用户 ${args.username} 已设为 ${args.role}`)
}

const setRole = async (args: ScriptArgs) => {
  if (isSqliteClient) {
    setRoleSqlite(args)
    return
  }

  let tx: sql.Transaction | null = null

  try {
    await pool.connect()
    console.log('✅ 数据库连接成功')

    tx = new sql.Transaction(pool)
    await tx.begin()
    console.log('✅ 已开启事务')

    await ensureOperatorPermission(args.operator, tx)

    const result = await tx
      .request()
      .input('username', sql.NVarChar, args.username)
      .query('SELECT id, username, role FROM users WHERE username = @username')

    if (result.recordset.length === 0) {
      throw new Error(`用户 ${args.username} 不存在`)
    }

    const user = result.recordset[0]
    console.log(`找到目标用户: ${user.username}, 当前角色: ${user.role || 'user'}`)

    await tx.request().input('id', sql.Int, user.id).input('role', sql.NVarChar, args.role).query(`
        UPDATE users
        SET role = @role,
            updated_at = GETDATE()
        WHERE id = @id
      `)

    await tx.commit()
    console.log(`✅ 用户 ${args.username} 已设为 ${args.role}`)
    console.log('✅ 事务提交成功')
  } catch (error) {
    console.error('❌ 设置角色失败:', error)

    if (tx) {
      try {
        await tx.rollback()
        console.log('↩️ 已执行事务回滚')
      } catch (rollbackError) {
        console.error('❌ 事务回滚失败:', rollbackError)
      }
    }

    throw error
  } finally {
    if (pool.connected) {
      await pool.close()
    }
  }
}

const args = parseArgs()
if (!args) {
  printUsage()
  process.exit(1)
}

setRole(args)
  .then(() => {
    console.log('🎉 脚本执行完毕')
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
