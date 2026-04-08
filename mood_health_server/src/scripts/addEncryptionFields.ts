import pool, { isSqliteClient } from '../config/database'

const addEncryptionFields = async () => {
  if (isSqliteClient) {
    console.error('❌ addEncryptionFields.ts 仅支持 SQL Server，请勿在 SQLite 模式下执行')
    process.exit(1)
  }

  try {
    await pool.connect()
    console.log('✅ 数据库连接成功')

    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('mood_records') 
        AND name = 'note_encrypted'
      )
      BEGIN
        ALTER TABLE mood_records
        ADD note_encrypted NVARCHAR(MAX) NULL
      END
    `)
    console.log('✅ mood_records 表添加 note_encrypted 字段成功')

    await pool.request().query(`
      IF EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('mood_records') 
        AND name = 'note'
      )
      BEGIN
        ALTER TABLE mood_records
        DROP COLUMN note
      END
    `)
    console.log('✅ mood_records 表删除 note 字段成功')

    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('users') 
        AND name = 'real_name_encrypted'
      )
      BEGIN
        ALTER TABLE users
        ADD real_name_encrypted NVARCHAR(MAX) NULL
      END
    `)
    console.log('✅ users 表添加 real_name_encrypted 字段成功')

    await pool.request().query(`
      IF EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('users') 
        AND name = 'real_name'
      )
      BEGIN
        ALTER TABLE users
        DROP COLUMN real_name
      END
    `)
    console.log('✅ users 表删除 real_name 字段成功')

    console.log('🎉 加密字段修改完成')
  } catch (error) {
    console.error('❌ 添加加密字段失败:', error)
  } finally {
    await pool.close()
  }
}

addEncryptionFields()
