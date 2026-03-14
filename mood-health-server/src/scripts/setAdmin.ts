import pool from "../config/database";
import sql from "mssql";

const setAdmin = async (username: string) => {
  try {
    await pool.connect();
    console.log("✅ 数据库连接成功");

    const result = await pool
      .request()
      .input("username", sql.NVarChar, username)
      .query("SELECT id, username, role FROM users WHERE username = @username");

    if (result.recordset.length === 0) {
      console.log(`❌ 用户 ${username} 不存在`);
      return;
    }

    const user = result.recordset[0];
    console.log(`找到用户: ${user.username}, 当前角色: ${user.role || "user"}`);

    await pool
      .request()
      .input("id", sql.Int, user.id)
      .input("role", sql.NVarChar, "admin")
      .query(`
        UPDATE users
        SET role = @role,
            updated_at = GETDATE()
        WHERE id = @id
      `);

    console.log(`✅ 用户 ${username} 已设为管理员`);
  } catch (error) {
    console.error("❌ 设置管理员失败:", error);
    throw error;
  } finally {
    await pool.close();
  }
};

const username = process.argv[2] || "testuser";
setAdmin(username)
  .then(() => {
    console.log("🎉 脚本执行完毕");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
