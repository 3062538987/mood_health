import sql from "mssql";
import { pool, connectDB } from "../config/database";

export const seedQuestionnaires = async () => {
  try {
    await connectDB();

    // 插入SDS量表
    const sdsResult = await pool.request().query(`
      INSERT INTO questionnaires (title, description, type)
      VALUES ('抑郁自评量表（SDS）', '抑郁自评量表是一种常用的心理测评工具，用于评估个体的抑郁程度。本量表包含20个问题，每个问题有4个选项，请根据您最近一周的实际情况选择最符合的答案。', 'SDS')
      SELECT SCOPE_IDENTITY() as id
    `);
    const sdsId = sdsResult.recordset[0].id;

    // SDS问题
    const sdsQuestions = [
      { text: '我觉得闷闷不乐，情绪低沉', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: false },
      { text: '我觉得一天之中早晨最好', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: true },
      { text: '我一阵阵哭出来或觉得想哭', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: false },
      { text: '我晚上睡眠不好', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: false },
      { text: '我吃得跟平常一样多', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: true },
      { text: '我与异性密切接触时和以往一样感到愉快', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: true },
      { text: '我发觉我的体重在下降', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: false },
      { text: '我有便秘的苦恼', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: false },
      { text: '我心跳比平时快', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: false },
      { text: '我无缘无故地感到疲乏', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: false },
      { text: '我的头脑跟平常一样清楚', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: true },
      { text: '我觉得经常做的事情并没有困难', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: true },
      { text: '我觉得不安而平静不下来', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: false },
      { text: '我对将来抱有希望', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: true },
      { text: '我比平常容易生气激动', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: false },
      { text: '我觉得作出决定是容易的', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: true },
      { text: '我觉得自己是个有用的人，有人需要我', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: true },
      { text: '我的生活过得很有意思', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: true },
      { text: '我认为如果我死了别人会生活得好些', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: false },
      { text: '平常感兴趣的事我仍然照样感兴趣', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: true }
    ];

    // 插入SDS问题
    for (let i = 0; i < sdsQuestions.length; i++) {
      await pool.request()
        .input('questionnaireId', sql.Int, sdsId)
        .input('questionText', sql.NVarChar, sdsQuestions[i].text)
        .input('questionType', sql.NVarChar, 'single')
        .input('options', sql.NVarChar, sdsQuestions[i].options)
        .input('sortOrder', sql.Int, i + 1)
        .input('isReverse', sql.Bit, sdsQuestions[i].isReverse)
        .query(`
          INSERT INTO questions (questionnaire_id, question_text, question_type, options, sort_order, is_reverse)
          VALUES (@questionnaireId, @questionText, @questionType, @options, @sortOrder, @isReverse)
        `);
    }

    // 插入SAS量表
    const sasResult = await pool.request().query(`
      INSERT INTO questionnaires (title, description, type)
      VALUES ('焦虑自评量表（SAS）', '焦虑自评量表是一种常用的心理测评工具，用于评估个体的焦虑程度。本量表包含20个问题，每个问题有4个选项，请根据您最近一周的实际情况选择最符合的答案。', 'SAS')
      SELECT SCOPE_IDENTITY() as id
    `);
    const sasId = sasResult.recordset[0].id;

    // SAS问题
    const sasQuestions = [
      { text: '我觉得比平时容易紧张和着急', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: false },
      { text: '我无缘无故地感到害怕', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: false },
      { text: '我容易心里烦乱或觉得惊恐', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: false },
      { text: '我觉得我可能将要发疯', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: false },
      { text: '我觉得一切都很好，也不会发生什么不幸', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: true },
      { text: '我手脚发抖打颤', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: false },
      { text: '我因为头痛、头颈痛和背痛而苦恼', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: false },
      { text: '我感觉容易衰弱和疲乏', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: false },
      { text: '我觉得心平气和，并且容易安静地坐着', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: true },
      { text: '我觉得心跳得很快', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: false },
      { text: '我因为一阵阵头晕而苦恼', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: false },
      { text: '我有晕倒发作，或觉得要晕倒似的', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: false },
      { text: '我吸气呼气都感到很容易', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: true },
      { text: '我的手脚麻木和刺痛', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: false },
      { text: '我因为胃痛和消化不良而苦恼', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: false },
      { text: '我常常要小便', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: false },
      { text: '我的手脚常常是干燥温暖的', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: true },
      { text: '我脸红发热', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: false },
      { text: '我容易入睡并且一夜睡得很好', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: true },
      { text: '我做恶梦', options: '["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"]', isReverse: false }
    ];

    // 插入SAS问题
    for (let i = 0; i < sasQuestions.length; i++) {
      await pool.request()
        .input('questionnaireId', sql.Int, sasId)
        .input('questionText', sql.NVarChar, sasQuestions[i].text)
        .input('questionType', sql.NVarChar, 'single')
        .input('options', sql.NVarChar, sasQuestions[i].options)
        .input('sortOrder', sql.Int, i + 1)
        .input('isReverse', sql.Bit, sasQuestions[i].isReverse)
        .query(`
          INSERT INTO questions (questionnaire_id, question_text, question_type, options, sort_order, is_reverse)
          VALUES (@questionnaireId, @questionText, @questionType, @options, @sortOrder, @isReverse)
        `);
    }

    console.log("✅ 量表数据插入完成");
  } catch (error) {
    console.error("❌ 量表数据插入失败:", error);
    throw error;
  }
};

// 直接运行
seedQuestionnaires()
  .then(() => {
    console.log("🎉 脚本执行完毕");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
