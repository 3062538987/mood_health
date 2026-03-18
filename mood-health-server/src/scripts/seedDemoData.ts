import crypto from 'crypto'
import sql from 'mssql'
import dotenv from 'dotenv'
import { connectDB, pool } from '../config/database'
import { hashPassword } from '../utils/password'

dotenv.config()

type DemoUserRole = 'super_admin' | 'admin' | 'user'

interface DemoUserConfig {
  username: string
  email: string
  role: DemoUserRole
  displayName: string
}

interface DemoMoodSeed {
  daysAgo: number
  moodType: string
  intensity: number
  note: string
  tags: string
  trigger: string
}

interface QuestionnaireRecord {
  id: number
  title: string
  type: string | null
}

interface QuestionRecord {
  id: number
  is_reverse: boolean
}

const DEMO_PREFIX = 'DEMO:'
const DEFAULT_PASSWORD = process.argv[2] || process.env.DEMO_USER_PASSWORD

if (!DEFAULT_PASSWORD) {
  throw new Error('DEMO_USER_PASSWORD or a CLI password argument is required')
}

const demoUsers: DemoUserConfig[] = [
  {
    username: 'super_admin_test1',
    email: 'super_admin_test1@example.com',
    role: 'super_admin',
    displayName: '测试超级管理员账号 1',
  },
  {
    username: 'super_admin_test2',
    email: 'super_admin_test2@example.com',
    role: 'super_admin',
    displayName: '测试超级管理员账号 2',
  },
  {
    username: 'admin_test1',
    email: 'admin_test1@example.com',
    role: 'admin',
    displayName: '测试管理员账号 1',
  },
  {
    username: 'admin_test2',
    email: 'admin_test2@example.com',
    role: 'admin',
    displayName: '测试管理员账号 2',
  },
  {
    username: 'admin_test3',
    email: 'admin_test3@example.com',
    role: 'admin',
    displayName: '测试管理员账号 3',
  },
  {
    username: 'admin_test4',
    email: 'admin_test4@example.com',
    role: 'admin',
    displayName: '测试管理员账号 4',
  },
  {
    username: 'student_test1',
    email: 'student_test1@example.com',
    role: 'user',
    displayName: '测试学生账号 1',
  },
  {
    username: 'student_test2',
    email: 'student_test2@example.com',
    role: 'user',
    displayName: '测试学生账号 2',
  },
  {
    username: 'student_test3',
    email: 'student_test3@example.com',
    role: 'user',
    displayName: '测试学生账号 3',
  },
  {
    username: 'student_test4',
    email: 'student_test4@example.com',
    role: 'user',
    displayName: '测试学生账号 4',
  },
]

const studentOneMoodSeeds: DemoMoodSeed[] = [
  {
    daysAgo: 6,
    moodType: '平静',
    intensity: 6,
    note: '课程安排比较顺利，今天整体状态平稳。',
    tags: '学习,健康',
    trigger: '作息规律',
  },
  {
    daysAgo: 5,
    moodType: '开心',
    intensity: 8,
    note: '和同学一起完成小组作业，成就感比较强。',
    tags: '学习,社交',
    trigger: '小组合作顺利',
  },
  {
    daysAgo: 4,
    moodType: '焦虑',
    intensity: 5,
    note: '临近汇报有一点紧张，但还能控制住。',
    tags: '学习',
    trigger: '课程汇报准备',
  },
  {
    daysAgo: 3,
    moodType: '疲惫',
    intensity: 4,
    note: '这两天睡得晚，白天注意力下降了一些。',
    tags: '健康',
    trigger: '睡眠不足',
  },
  {
    daysAgo: 2,
    moodType: '兴奋',
    intensity: 8,
    note: '报名了减压徒步活动，对周末安排很期待。',
    tags: '活动,社交',
    trigger: '活动报名成功',
  },
  {
    daysAgo: 1,
    moodType: '平静',
    intensity: 7,
    note: '今天安排比较从容，能专心处理手头任务。',
    tags: '学习,生活',
    trigger: '日程清晰',
  },
  {
    daysAgo: 0,
    moodType: '开心',
    intensity: 9,
    note: '这周整体状态不错，准备继续保持。',
    tags: '总结,健康',
    trigger: '状态回升',
  },
]

const studentTwoMoodSeeds: DemoMoodSeed[] = [
  {
    daysAgo: 3,
    moodType: '焦虑',
    intensity: 5,
    note: '最近任务有点多，需要重新排优先级。',
    tags: '学习',
    trigger: '任务堆积',
  },
  {
    daysAgo: 2,
    moodType: '平静',
    intensity: 6,
    note: '和室友聊完之后，情绪缓和了不少。',
    tags: '社交',
    trigger: '获得支持',
  },
  {
    daysAgo: 1,
    moodType: '开心',
    intensity: 7,
    note: '完成阶段目标后轻松很多。',
    tags: '学习,成就',
    trigger: '任务完成',
  },
  {
    daysAgo: 0,
    moodType: '平静',
    intensity: 7,
    note: '准备按计划推进接下来的安排。',
    tags: '生活',
    trigger: '节奏稳定',
  },
]

const createDateOnly = (daysAgo: number) => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString().slice(0, 10)
}

const createDateTime = (daysFromNow: number, hour: number, minute: number) => {
  const date = new Date()
  date.setSeconds(0, 0)
  date.setDate(date.getDate() + daysFromNow)
  date.setHours(hour, minute, 0, 0)
  return date
}

const encryptNote = (text: string) => {
  const encryptionKey = process.env.ENCRYPTION_KEY
  if (!text) {
    return text
  }

  if (!encryptionKey) {
    return text
  }

  const key = Buffer.from(encryptionKey, 'hex')
  if (key.length !== 32) {
    return text
  }

  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  return JSON.stringify({
    encrypted,
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
  })
}

const ensureSchema = async () => {
  await pool.request().query(`
    IF OBJECT_ID('users', 'U') IS NULL
    BEGIN
      CREATE TABLE users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        username NVARCHAR(50) NOT NULL UNIQUE,
        password NVARCHAR(255) NOT NULL,
        email NVARCHAR(100) NOT NULL UNIQUE,
        avatar NVARCHAR(255) NULL,
        role NVARCHAR(20) NOT NULL CONSTRAINT DF_users_role DEFAULT 'user',
        created_at DATETIME NOT NULL CONSTRAINT DF_users_created_at DEFAULT GETDATE(),
        updated_at DATETIME NOT NULL CONSTRAINT DF_users_updated_at DEFAULT GETDATE()
      )
    END

    IF COL_LENGTH('users', 'role') IS NULL
      ALTER TABLE users ADD role NVARCHAR(20) NOT NULL CONSTRAINT DF_users_role_legacy DEFAULT 'user';
    IF COL_LENGTH('users', 'updated_at') IS NULL
      ALTER TABLE users ADD updated_at DATETIME NOT NULL CONSTRAINT DF_users_updated_at_legacy DEFAULT GETDATE();

    IF OBJECT_ID('moods', 'U') IS NULL
    BEGIN
      CREATE TABLE moods (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        mood_type NVARCHAR(50) NOT NULL,
        intensity INT NOT NULL,
        note_encrypted NVARCHAR(MAX) NULL,
        tags NVARCHAR(255) NULL,
        [trigger] NVARCHAR(255) NULL,
        record_date DATE NOT NULL,
        created_at DATETIME NOT NULL CONSTRAINT DF_moods_created_at DEFAULT GETDATE(),
        updated_at DATETIME NOT NULL CONSTRAINT DF_moods_updated_at DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    END

    IF COL_LENGTH('moods', 'intensity') IS NULL
      ALTER TABLE moods ADD intensity INT NULL;
    IF COL_LENGTH('moods', 'note_encrypted') IS NULL
      ALTER TABLE moods ADD note_encrypted NVARCHAR(MAX) NULL;
    IF COL_LENGTH('moods', 'tags') IS NULL
      ALTER TABLE moods ADD tags NVARCHAR(255) NULL;
    IF COL_LENGTH('moods', 'trigger') IS NULL
      ALTER TABLE moods ADD [trigger] NVARCHAR(255) NULL;
    IF COL_LENGTH('moods', 'record_date') IS NULL
      ALTER TABLE moods ADD record_date DATE NULL;
    IF COL_LENGTH('moods', 'updated_at') IS NULL
      ALTER TABLE moods ADD updated_at DATETIME NOT NULL CONSTRAINT DF_moods_updated_at_legacy DEFAULT GETDATE();
    IF COL_LENGTH('moods', 'mood_score') IS NOT NULL
      EXEC('UPDATE moods SET intensity = ISNULL(intensity, mood_score) WHERE intensity IS NULL;');
    IF COL_LENGTH('moods', 'created_at') IS NOT NULL
      UPDATE moods SET record_date = ISNULL(record_date, CAST(created_at AS DATE)) WHERE record_date IS NULL;
    UPDATE moods SET updated_at = ISNULL(updated_at, GETDATE()) WHERE updated_at IS NULL;

    IF OBJECT_ID('activities', 'U') IS NULL
    BEGIN
      CREATE TABLE activities (
        id INT IDENTITY(1,1) PRIMARY KEY,
        title NVARCHAR(100) NOT NULL,
        description NVARCHAR(MAX) NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        max_participants INT NOT NULL CONSTRAINT DF_activities_max DEFAULT 20,
        current_participants INT NOT NULL CONSTRAINT DF_activities_current DEFAULT 0,
        location NVARCHAR(255) NULL,
        image_url NVARCHAR(255) NULL,
        created_at DATETIME NOT NULL CONSTRAINT DF_activities_created DEFAULT GETDATE(),
        updated_at DATETIME NOT NULL CONSTRAINT DF_activities_updated DEFAULT GETDATE()
      )
    END

    IF COL_LENGTH('activities', 'current_participants') IS NULL
      ALTER TABLE activities ADD current_participants INT NOT NULL CONSTRAINT DF_activities_current_legacy DEFAULT 0;
    IF COL_LENGTH('activities', 'updated_at') IS NULL
      ALTER TABLE activities ADD updated_at DATETIME NOT NULL CONSTRAINT DF_activities_updated_legacy DEFAULT GETDATE();

    IF OBJECT_ID('activity_participants', 'U') IS NULL
    BEGIN
      CREATE TABLE activity_participants (
        id INT IDENTITY(1,1) PRIMARY KEY,
        activity_id INT NOT NULL,
        user_id INT NOT NULL,
        join_time DATETIME NOT NULL CONSTRAINT DF_activity_participants_join_time DEFAULT GETDATE(),
        FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT UQ_activity_participants UNIQUE (activity_id, user_id)
      )
    END

    IF OBJECT_ID('posts', 'U') IS NULL
    BEGIN
      CREATE TABLE posts (
        id INT IDENTITY(1,1) PRIMARY KEY,
        title NVARCHAR(255) NOT NULL,
        content NVARCHAR(MAX) NOT NULL,
        user_id INT NULL,
        is_anonymous BIT NOT NULL CONSTRAINT DF_posts_is_anonymous_seed DEFAULT 0,
        like_count INT NOT NULL CONSTRAINT DF_posts_like_count_seed DEFAULT 0,
        status INT NOT NULL CONSTRAINT DF_posts_status_seed DEFAULT 1,
        audit_remark NVARCHAR(255) NULL,
        created_at DATETIME NOT NULL CONSTRAINT DF_posts_created_seed DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    END

    IF COL_LENGTH('posts', 'title') IS NULL
      ALTER TABLE posts ADD title NVARCHAR(255) NULL;
    IF COL_LENGTH('posts', 'is_anonymous') IS NULL
      ALTER TABLE posts ADD is_anonymous BIT NOT NULL CONSTRAINT DF_posts_is_anonymous_legacy DEFAULT 0;
    IF COL_LENGTH('posts', 'like_count') IS NULL
      ALTER TABLE posts ADD like_count INT NOT NULL CONSTRAINT DF_posts_like_count_legacy DEFAULT 0;
    IF COL_LENGTH('posts', 'status') IS NULL
      ALTER TABLE posts ADD status INT NOT NULL CONSTRAINT DF_posts_status_legacy DEFAULT 1;
    IF COL_LENGTH('posts', 'audit_remark') IS NULL
      ALTER TABLE posts ADD audit_remark NVARCHAR(255) NULL;

    IF OBJECT_ID('comments', 'U') IS NULL
    BEGIN
      CREATE TABLE comments (
        id INT IDENTITY(1,1) PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT NULL,
        content NVARCHAR(MAX) NOT NULL,
        is_anonymous BIT NOT NULL CONSTRAINT DF_comments_is_anonymous_seed DEFAULT 0,
        like_count INT NOT NULL CONSTRAINT DF_comments_like_count_seed DEFAULT 0,
        created_at DATETIME NOT NULL CONSTRAINT DF_comments_created_seed DEFAULT GETDATE(),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    END

    IF COL_LENGTH('comments', 'is_anonymous') IS NULL
      ALTER TABLE comments ADD is_anonymous BIT NOT NULL CONSTRAINT DF_comments_is_anonymous_legacy DEFAULT 0;
    IF COL_LENGTH('comments', 'like_count') IS NULL
      ALTER TABLE comments ADD like_count INT NOT NULL CONSTRAINT DF_comments_like_count_legacy DEFAULT 0;

    IF OBJECT_ID('post_likes', 'U') IS NULL
    BEGIN
      CREATE TABLE post_likes (
        id INT IDENTITY(1,1) PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at DATETIME NOT NULL CONSTRAINT DF_post_likes_created_seed DEFAULT GETDATE(),
        CONSTRAINT UQ_post_likes UNIQUE (post_id, user_id),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    END

    IF OBJECT_ID('comment_likes', 'U') IS NULL
    BEGIN
      CREATE TABLE comment_likes (
        id INT IDENTITY(1,1) PRIMARY KEY,
        comment_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at DATETIME NOT NULL CONSTRAINT DF_comment_likes_created_seed DEFAULT GETDATE(),
        CONSTRAINT UQ_comment_likes UNIQUE (comment_id, user_id),
        FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    END

    IF OBJECT_ID('questionnaires', 'U') IS NULL
    BEGIN
      CREATE TABLE questionnaires (
        id INT IDENTITY(1,1) PRIMARY KEY,
        title NVARCHAR(100) NOT NULL,
        description NVARCHAR(500) NULL,
        type NVARCHAR(50) NULL,
        created_at DATETIME NOT NULL CONSTRAINT DF_questionnaires_created_seed DEFAULT GETDATE()
      )
    END

    IF COL_LENGTH('questionnaires', 'type') IS NULL
      ALTER TABLE questionnaires ADD type NVARCHAR(50) NULL;

    IF OBJECT_ID('questions', 'U') IS NULL
    BEGIN
      CREATE TABLE questions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        questionnaire_id INT NOT NULL,
        question_text NVARCHAR(500) NOT NULL,
        question_type NVARCHAR(20) NULL,
        options NVARCHAR(MAX) NULL,
        sort_order INT NULL,
        is_reverse BIT NOT NULL CONSTRAINT DF_questions_is_reverse_seed DEFAULT 0,
        FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE
      )
    END

    IF COL_LENGTH('questions', 'is_reverse') IS NULL
      ALTER TABLE questions ADD is_reverse BIT NOT NULL CONSTRAINT DF_questions_is_reverse_legacy DEFAULT 0;

    IF OBJECT_ID('user_assessments', 'U') IS NULL
    BEGIN
      CREATE TABLE user_assessments (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        questionnaire_id INT NOT NULL,
        score INT NOT NULL,
        result_text NVARCHAR(MAX) NULL,
        created_at DATETIME NOT NULL CONSTRAINT DF_user_assessments_created_seed DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE
      )
    END

    IF OBJECT_ID('user_answers', 'U') IS NULL
    BEGIN
      CREATE TABLE user_answers (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        questionnaire_id INT NOT NULL,
        question_id INT NOT NULL,
        answer NVARCHAR(MAX) NULL,
        submitted_at DATETIME NOT NULL CONSTRAINT DF_user_answers_submitted_seed DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE,
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
      )
    END
  `)
}

const upsertDemoUser = async (user: DemoUserConfig, password: string) => {
  const hashedPassword = await hashPassword(password)
  const result = await pool
    .request()
    .input('username', sql.NVarChar, user.username)
    .input('password', sql.NVarChar, hashedPassword)
    .input('email', sql.NVarChar, user.email)
    .input('role', sql.NVarChar, user.role).query(`
      IF EXISTS (SELECT 1 FROM users WHERE username = @username)
      BEGIN
        UPDATE users
        SET password = @password,
            email = @email,
            role = @role,
            updated_at = GETDATE()
        WHERE username = @username;

        SELECT id, username, role FROM users WHERE username = @username;
      END
      ELSE
      BEGIN
        INSERT INTO users (username, password, email, role)
        OUTPUT INSERTED.id, INSERTED.username, INSERTED.role
        VALUES (@username, @password, @email, @role);
      END
    `)

  return result.recordset[0] as { id: number; username: string; role: string }
}

const cleanupDemoData = async (demoUserIds: number[]) => {
  const idPlaceholders = demoUserIds.map((_, index) => `@userId${index}`).join(', ')
  const request = pool.request().input('demoPrefix', sql.NVarChar, `${DEMO_PREFIX}%`)
  demoUserIds.forEach((userId, index) => {
    request.input(`userId${index}`, sql.Int, userId)
  })

  await request.query(`
    DELETE FROM user_answers WHERE user_id IN (${idPlaceholders});
    DELETE FROM user_assessments WHERE user_id IN (${idPlaceholders});
    DELETE FROM moods WHERE user_id IN (${idPlaceholders});

    DELETE FROM activity_participants WHERE user_id IN (${idPlaceholders});
    DELETE FROM activity_participants WHERE activity_id IN (
      SELECT id FROM activities WHERE title LIKE @demoPrefix
    );
    DELETE FROM activities WHERE title LIKE @demoPrefix;

    DELETE FROM posts WHERE user_id IN (${idPlaceholders}) OR title LIKE @demoPrefix;

    UPDATE activities
    SET current_participants = participant_counts.total
    FROM activities
    CROSS APPLY (
      SELECT COUNT(*) AS total
      FROM activity_participants ap
      WHERE ap.activity_id = activities.id
    ) AS participant_counts;
  `)
}

const seedMoodsForUser = async (userId: number, seeds: DemoMoodSeed[]) => {
  for (const seed of seeds) {
    await pool
      .request()
      .input('userId', sql.Int, userId)
      .input('moodType', sql.NVarChar, seed.moodType)
      .input('intensity', sql.Int, seed.intensity)
      .input('note', sql.NVarChar(sql.MAX), encryptNote(seed.note))
      .input('tags', sql.NVarChar, seed.tags)
      .input('trigger', sql.NVarChar, seed.trigger)
      .input('recordDate', sql.Date, createDateOnly(seed.daysAgo)).query(`
        INSERT INTO moods (user_id, mood_type, intensity, note_encrypted, tags, [trigger], record_date)
        VALUES (@userId, @moodType, @intensity, @note, @tags, @trigger, @recordDate)
      `)
  }
}

const seedPosts = async (studentOneId: number, studentTwoId: number) => {
  const posts = [
    {
      title: `${DEMO_PREFIX} 最近一周作息恢复得不错`,
      content: '这周尝试提前半小时睡觉，白天上课的专注度明显好了很多。',
      userId: studentOneId,
      isAnonymous: false,
      status: 1,
      auditRemark: null,
    },
    {
      title: `${DEMO_PREFIX} 想给自己留一点喘息时间`,
      content: '最近任务很多，但也开始学着给自己安排短暂休息，情绪没有之前那么绷着了。',
      userId: studentTwoId,
      isAnonymous: true,
      status: 1,
      auditRemark: null,
    },
    {
      title: `${DEMO_PREFIX} 周末准备去参加减压活动`,
      content: '第一次报名这种线下活动，希望能认识一些同样在调节情绪的同学。',
      userId: studentOneId,
      isAnonymous: false,
      status: 1,
      auditRemark: null,
    },
    {
      title: `${DEMO_PREFIX} 最近在练习情绪记录`,
      content: '把情绪写下来之后，能更快发现哪些事情最容易影响自己。',
      userId: studentTwoId,
      isAnonymous: false,
      status: 1,
      auditRemark: null,
    },
    {
      title: `${DEMO_PREFIX} 这条帖子用于审核演示`,
      content: '这是专门保留给管理员账号演示审核流程的一条待审核帖子。',
      userId: studentOneId,
      isAnonymous: true,
      status: 0,
      auditRemark: '演示数据，保留待审核状态',
    },
  ]

  const insertedPostIds: number[] = []

  for (const post of posts) {
    const result = await pool
      .request()
      .input('title', sql.NVarChar, post.title)
      .input('content', sql.NVarChar(sql.MAX), post.content)
      .input('userId', sql.Int, post.userId)
      .input('isAnonymous', sql.Bit, post.isAnonymous ? 1 : 0)
      .input('status', sql.Int, post.status)
      .input('auditRemark', sql.NVarChar, post.auditRemark).query(`
        INSERT INTO posts (title, content, user_id, is_anonymous, status, audit_remark)
        OUTPUT INSERTED.id
        VALUES (@title, @content, @userId, @isAnonymous, @status, @auditRemark)
      `)

    insertedPostIds.push(result.recordset[0].id as number)
  }

  await pool
    .request()
    .input('postId', sql.Int, insertedPostIds[0])
    .input('userId', sql.Int, studentTwoId)
    .input('content', sql.NVarChar(sql.MAX), '这条分享很有共鸣，我也在努力调整自己的节奏。').query(`
      INSERT INTO comments (post_id, user_id, content, is_anonymous)
      VALUES (@postId, @userId, @content, 0)
    `)
}

const seedActivities = async (studentOneId: number, studentTwoId: number) => {
  const activities = [
    {
      title: `${DEMO_PREFIX} 春日减压徒步`,
      description: '轻松徒步与情绪放松结合的线下活动，适合演示报名流程。',
      startTime: createDateTime(2, 15, 0),
      endTime: createDateTime(2, 17, 0),
      maxParticipants: 20,
      location: '校园东门集合',
      imageUrl: null,
    },
    {
      title: `${DEMO_PREFIX} 正念呼吸练习坊`,
      description: '面向压力管理的短时工作坊，用于演示活动详情与报名记录。',
      startTime: createDateTime(4, 19, 0),
      endTime: createDateTime(4, 20, 30),
      maxParticipants: 16,
      location: '心理中心 203',
      imageUrl: null,
    },
    {
      title: `${DEMO_PREFIX} 情绪复盘分享会`,
      description: '围绕一周情绪记录做经验交流，适合演示未来活动列表。',
      startTime: createDateTime(6, 14, 30),
      endTime: createDateTime(6, 16, 0),
      maxParticipants: 24,
      location: '活动中心 301',
      imageUrl: null,
    },
  ]

  const activityIds: number[] = []

  for (const activity of activities) {
    const result = await pool
      .request()
      .input('title', sql.NVarChar, activity.title)
      .input('description', sql.NVarChar(sql.MAX), activity.description)
      .input('startTime', sql.DateTime, activity.startTime)
      .input('endTime', sql.DateTime, activity.endTime)
      .input('maxParticipants', sql.Int, activity.maxParticipants)
      .input('location', sql.NVarChar, activity.location)
      .input('imageUrl', sql.NVarChar, activity.imageUrl).query(`
        INSERT INTO activities (title, description, start_time, end_time, max_participants, current_participants, location, image_url)
        OUTPUT INSERTED.id
        VALUES (@title, @description, @startTime, @endTime, @maxParticipants, 0, @location, @imageUrl)
      `)

    activityIds.push(result.recordset[0].id as number)
  }

  await pool
    .request()
    .input('activityId', sql.Int, activityIds[0])
    .input('userId', sql.Int, studentOneId).query(`
      INSERT INTO activity_participants (activity_id, user_id)
      VALUES (@activityId, @userId)
    `)

  await pool
    .request()
    .input('activityId', sql.Int, activityIds[1])
    .input('userId', sql.Int, studentTwoId).query(`
      INSERT INTO activity_participants (activity_id, user_id)
      VALUES (@activityId, @userId)
    `)

  await pool.request().query(`
    UPDATE activities
    SET current_participants = participant_counts.total
    FROM activities
    CROSS APPLY (
      SELECT COUNT(*) AS total
      FROM activity_participants ap
      WHERE ap.activity_id = activities.id
    ) AS participant_counts
    WHERE activities.title LIKE '${DEMO_PREFIX}%'
  `)
}

const ensureQuestionnaireForDemo = async (): Promise<{
  questionnaire: QuestionnaireRecord
  questions: QuestionRecord[]
}> => {
  const existingQuestionnaireResult = await pool.request().query(`
    SELECT TOP 1 q.id, q.title, q.type
    FROM questionnaires q
    OUTER APPLY (
      SELECT COUNT(*) AS question_count
      FROM questions qq
      WHERE qq.questionnaire_id = q.id
    ) counts
    ORDER BY CASE WHEN counts.question_count > 0 THEN 0 ELSE 1 END, q.id ASC
  `)

  let questionnaire = existingQuestionnaireResult.recordset[0] as QuestionnaireRecord | undefined

  if (!questionnaire) {
    const insertQuestionnaireResult = await pool.request().query(`
      INSERT INTO questionnaires (title, description, type)
      OUTPUT INSERTED.id, INSERTED.title, INSERTED.type
      VALUES (
        N'${DEMO_PREFIX} 演示心理状态问卷',
        N'用于演示问卷结果与历史记录的简化问卷。',
        N'DEMO'
      )
    `)
    questionnaire = insertQuestionnaireResult.recordset[0] as QuestionnaireRecord
  }

  let questionsResult = await pool.request().input('questionnaireId', sql.Int, questionnaire.id)
    .query(`
      SELECT id, is_reverse
      FROM questions
      WHERE questionnaire_id = @questionnaireId
      ORDER BY sort_order ASC, id ASC
    `)

  if (questionsResult.recordset.length === 0) {
    const demoQuestions = [
      { text: '最近一周我能较快从压力中缓过来', isReverse: true },
      { text: '最近一周我经常感到紧张', isReverse: false },
      { text: '最近一周我的睡眠质量稳定', isReverse: true },
      { text: '最近一周我会主动向他人寻求支持', isReverse: true },
      { text: '最近一周我感到学习或生活负担偏重', isReverse: false },
    ]

    for (let index = 0; index < demoQuestions.length; index++) {
      const question = demoQuestions[index]
      await pool
        .request()
        .input('questionnaireId', sql.Int, questionnaire.id)
        .input('questionText', sql.NVarChar, question.text)
        .input('questionType', sql.NVarChar, 'single')
        .input(
          'options',
          sql.NVarChar,
          JSON.stringify(['完全不符合', '比较不符合', '比较符合', '完全符合'])
        )
        .input('sortOrder', sql.Int, index + 1)
        .input('isReverse', sql.Bit, question.isReverse ? 1 : 0).query(`
          INSERT INTO questions (questionnaire_id, question_text, question_type, options, sort_order, is_reverse)
          VALUES (@questionnaireId, @questionText, @questionType, @options, @sortOrder, @isReverse)
        `)
    }

    questionsResult = await pool.request().input('questionnaireId', sql.Int, questionnaire.id)
      .query(`
        SELECT id, is_reverse
        FROM questions
        WHERE questionnaire_id = @questionnaireId
        ORDER BY sort_order ASC, id ASC
      `)
  }

  return {
    questionnaire,
    questions: questionsResult.recordset as QuestionRecord[],
  }
}

const buildQuestionnaireResultText = (
  type: string | null,
  score: number,
  questionCount: number
) => {
  if (type === 'SDS') {
    if (score < 53) return '正常：演示账号当前抑郁风险较低，状态总体平稳。'
    if (score < 63) return '轻度抑郁：演示账号存在轻度情绪低落表现，建议继续关注。'
    if (score < 73) return '中度抑郁：演示账号近期需要加强情绪支持与规律作息。'
    return '重度抑郁：演示账号结果显示需尽快寻求专业帮助。'
  }

  if (type === 'SAS') {
    if (score < 50) return '正常：演示账号当前焦虑水平在正常范围内。'
    if (score < 60) return '轻度焦虑：演示账号存在轻微紧张状态，可结合放松练习调整。'
    if (score < 70) return '中度焦虑：演示账号近期压力较高，建议增加支持性干预。'
    return '重度焦虑：演示账号焦虑水平较高，建议及时转介专业支持。'
  }

  return `演示问卷已完成，共 ${questionCount} 题，综合得分 ${score}，当前建议继续保持规律作息并关注压力变化。`
}

const seedAssessment = async (
  userId: number,
  questionnaire: QuestionnaireRecord,
  questions: QuestionRecord[]
) => {
  const answers = questions.map((_, index) => [1, 2, 1, 0][index % 4])

  let score = 0
  for (let index = 0; index < questions.length; index++) {
    let questionScore = answers[index] + 1
    if (questions[index].is_reverse) {
      questionScore = 5 - questionScore
    }
    score += questionScore
  }

  for (let index = 0; index < questions.length; index++) {
    await pool
      .request()
      .input('userId', sql.Int, userId)
      .input('questionnaireId', sql.Int, questionnaire.id)
      .input('questionId', sql.Int, questions[index].id)
      .input('answer', sql.NVarChar, String(answers[index])).query(`
        INSERT INTO user_answers (user_id, questionnaire_id, question_id, answer)
        VALUES (@userId, @questionnaireId, @questionId, @answer)
      `)
  }

  await pool
    .request()
    .input('userId', sql.Int, userId)
    .input('questionnaireId', sql.Int, questionnaire.id)
    .input('score', sql.Int, score)
    .input(
      'resultText',
      sql.NVarChar(sql.MAX),
      buildQuestionnaireResultText(questionnaire.type, score, questions.length)
    ).query(`
      INSERT INTO user_assessments (user_id, questionnaire_id, score, result_text)
      VALUES (@userId, @questionnaireId, @score, @resultText)
    `)
}

const printSummary = (accounts: Array<{ username: string; role: string }>) => {
  console.log('\n演示账号初始化完成：')
  accounts.forEach((account) => {
    console.log(`- ${account.username} (${account.role}) / ${DEFAULT_PASSWORD}`)
  })
  console.log('\n已写入演示数据：')
  console.log('- 2 个超级管理员账号')
  console.log('- 4 个普通管理员账号')
  console.log('- 4 个测试学生账号')
  console.log('- student_test1 最近 7 天情绪记录')
  console.log('- student_test2 最近 4 天情绪记录')
  console.log('- 5 条树洞帖子，其中 1 条待审核')
  console.log('- 3 个未来活动，2 个学生账号各报名 1 个')
  console.log('- 1 条问卷结果记录与答案明细')
}

const main = async () => {
  try {
    await connectDB()
    console.log('✅ 数据库连接成功')

    await ensureSchema()
    console.log('✅ 演示数据所需表结构检查完成')

    const accounts = [] as Array<{ id: number; username: string; role: string }>
    for (const user of demoUsers) {
      const account = await upsertDemoUser(user, DEFAULT_PASSWORD)
      accounts.push(account)
    }
    console.log('✅ 演示账号创建/更新完成')

    const studentOne = accounts.find((account) => account.username === 'student_test1')
    const studentTwo = accounts.find((account) => account.username === 'student_test2')

    if (!studentOne || !studentTwo) {
      throw new Error('未能创建测试学生账号')
    }

    await cleanupDemoData(accounts.map((account) => account.id))
    console.log('✅ 已清理旧的演示数据')

    await seedMoodsForUser(studentOne.id, studentOneMoodSeeds)
    await seedMoodsForUser(studentTwo.id, studentTwoMoodSeeds)
    console.log('✅ 情绪记录写入完成')

    await seedPosts(studentOne.id, studentTwo.id)
    console.log('✅ 树洞帖子写入完成')

    await seedActivities(studentOne.id, studentTwo.id)
    console.log('✅ 活动与报名记录写入完成')

    const questionnaireSetup = await ensureQuestionnaireForDemo()
    await seedAssessment(
      studentOne.id,
      questionnaireSetup.questionnaire,
      questionnaireSetup.questions
    )
    console.log('✅ 问卷结果写入完成')

    printSummary(accounts)
  } catch (error) {
    console.error('❌ 初始化演示数据失败:', error)
    process.exitCode = 1
  } finally {
    if (pool.connected) {
      await pool.close()
    }
  }
}

main()
