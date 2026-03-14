import { query, connectDB } from './config/database';

const testQuestionnaireHistory = async () => {
  try {
    await connectDB();
    console.log('✅ 数据库连接成功');

    // 测试获取用户测评历史
    const testUserId = 1;
    const historyQuery = `
      SELECT 
        ua.id,
        ua.user_id,
        ua.questionnaire_id,
        ua.score,
        ua.result_text,
        ua.created_at,
        q.title,
        q.type
      FROM user_assessments ua
      INNER JOIN questionnaires q ON ua.questionnaire_id = q.id
      WHERE ua.user_id = @userId
      ORDER BY ua.created_at DESC
    `;

    const result = await pool.request()
      .input('userId', sql.Int, testUserId)
      .query(historyQuery);

    console.log('✅ 用户测评历史记录:');
    console.log(result.recordset);

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
};

import pool from './config/database';
import sql from 'mssql';

testQuestionnaireHistory();