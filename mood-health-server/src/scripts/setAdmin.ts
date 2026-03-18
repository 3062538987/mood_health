/**
 * 兼容脚本：历史 setAdmin 调用入口
 * 建议改用 setRole.ts：
 * npx ts-node src/scripts/setRole.ts --username <name> --role admin --operator <super_admin_username>
 */

const username = process.argv[2] || 'testuser'

console.log('⚠️ setAdmin.ts 已废弃，请改用 setRole.ts')
console.log(
  `建议命令: npx ts-node src/scripts/setRole.ts --username ${username} --role admin --operator <super_admin_username>`
)
process.exit(1)
