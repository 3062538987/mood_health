import fs from 'fs'
import path from 'path'
import { DatabaseSync } from 'node:sqlite'

type SqliteStatement = {
  all: (...params: any[]) => any
  get: (...params: any[]) => any
  run: (...params: any[]) => any
}

type SqliteDatabase = DatabaseSync

let sqliteDb: SqliteDatabase | null = null

const resolveSqliteDbPath = () =>
  process.env.SQLITE_DB_PATH
    ? path.resolve(process.cwd(), process.env.SQLITE_DB_PATH)
    : path.resolve(process.cwd(), 'data', 'mood-health.db')

const ensureDirectory = (filePath: string) => {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

const initSchema = (db: SqliteDatabase) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      nickname TEXT,
      avatar TEXT,
      role TEXT DEFAULT 'user',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS emotion_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon TEXT,
      category TEXT,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      user_id INTEGER,
      is_system INTEGER DEFAULT 0,
      UNIQUE (name, user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS moods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      mood_type TEXT NOT NULL,
      intensity INTEGER NOT NULL,
      note_encrypted TEXT,
      tags TEXT,
      trigger TEXT,
      record_date TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS mood_emotions (
      mood_id INTEGER NOT NULL,
      emotion_type_id INTEGER NOT NULL,
      intensity INTEGER NOT NULL,
      PRIMARY KEY (mood_id, emotion_type_id),
      FOREIGN KEY (mood_id) REFERENCES moods(id) ON DELETE CASCADE,
      FOREIGN KEY (emotion_type_id) REFERENCES emotion_types(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS mood_tags (
      mood_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (mood_id, tag_id),
      FOREIGN KEY (mood_id) REFERENCES moods(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      max_participants INTEGER DEFAULT 20,
      current_participants INTEGER DEFAULT 0,
      location TEXT,
      image_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activity_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE (activity_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_activities_start_time ON activities(start_time);
    CREATE INDEX IF NOT EXISTS idx_activity_participants_activity ON activity_participants(activity_id);
    CREATE INDEX IF NOT EXISTS idx_activity_participants_user ON activity_participants(user_id);
    CREATE INDEX IF NOT EXISTS idx_moods_user_date ON moods(user_id, record_date DESC);
    CREATE INDEX IF NOT EXISTS idx_mood_emotions_mood ON mood_emotions(mood_id);
    CREATE INDEX IF NOT EXISTS idx_mood_emotions_emotion ON mood_emotions(emotion_type_id);
    CREATE INDEX IF NOT EXISTS idx_mood_tags_mood ON mood_tags(mood_id);
    CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id, name);

    CREATE TABLE IF NOT EXISTS advice_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      mood_record_id INTEGER,
      analysis TEXT NOT NULL,
      suggestions TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operator_id INTEGER,
      operator_role TEXT NOT NULL,
      permission_code TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      target_id TEXT,
      content TEXT,
      operation_time TEXT DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT,
      operation_result TEXT NOT NULL,
      FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS incident_fix_list (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fixer_id INTEGER,
      fixer_role TEXT NOT NULL,
      issue_description TEXT NOT NULL,
      fix_content TEXT NOT NULL,
      result TEXT DEFAULT 'success',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (fixer_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS feedback_close_list (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      handler_id INTEGER,
      handler_role TEXT NOT NULL,
      feedback_id TEXT NOT NULL,
      handle_content TEXT NOT NULL,
      close_status TEXT DEFAULT 'closed',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (handler_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      user_id INTEGER,
      is_anonymous INTEGER NOT NULL DEFAULT 0,
      like_count INTEGER NOT NULL DEFAULT 0,
      status INTEGER NOT NULL DEFAULT 1,
      audit_remark TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER,
      content TEXT NOT NULL,
      is_anonymous INTEGER NOT NULL DEFAULT 0,
      like_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS post_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (post_id, user_id),
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comment_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comment_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (comment_id, user_id),
      FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS questionnaires (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      questionnaire_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      question_type TEXT,
      options TEXT,
      sort_order INTEGER,
      is_reverse INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      questionnaire_id INTEGER NOT NULL,
      score INTEGER NOT NULL,
      result_text TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      questionnaire_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      answer TEXT,
      submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_advice_history_user_id ON advice_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_advice_history_created_at ON advice_history(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_operation_logs_time ON operation_logs(operation_time DESC);
    CREATE INDEX IF NOT EXISTS idx_operation_logs_role ON operation_logs(operator_role);
    CREATE INDEX IF NOT EXISTS idx_operation_logs_permission ON operation_logs(permission_code);
    CREATE INDEX IF NOT EXISTS idx_incident_fix_created_at ON incident_fix_list(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_feedback_close_created_at ON feedback_close_list(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_posts_status_created_at ON posts(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_comments_post_created_at ON comments(post_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_post_likes_post_user ON post_likes(post_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_user ON comment_likes(comment_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_questions_questionnaire_order ON questions(questionnaire_id, sort_order ASC);
    CREATE INDEX IF NOT EXISTS idx_user_assessments_user_created ON user_assessments(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_user_answers_user_questionnaire ON user_answers(user_id, questionnaire_id);

    INSERT INTO emotion_types (name, icon, category, sort_order) VALUES ('快乐', 'smile', 'positive', 1)
    ON CONFLICT(name) DO NOTHING;
    INSERT INTO emotion_types (name, icon, category, sort_order) VALUES ('平静', 'leaf', 'neutral', 2)
    ON CONFLICT(name) DO NOTHING;
    INSERT INTO emotion_types (name, icon, category, sort_order) VALUES ('疲惫', 'moon', 'neutral', 3)
    ON CONFLICT(name) DO NOTHING;
    INSERT INTO emotion_types (name, icon, category, sort_order) VALUES ('焦虑', 'alert-circle', 'negative', 4)
    ON CONFLICT(name) DO NOTHING;
    INSERT INTO emotion_types (name, icon, category, sort_order) VALUES ('悲伤', 'cloud-rain', 'negative', 5)
    ON CONFLICT(name) DO NOTHING;
    INSERT INTO emotion_types (name, icon, category, sort_order) VALUES ('愤怒', 'flame', 'negative', 6)
    ON CONFLICT(name) DO NOTHING;
    INSERT INTO emotion_types (name, icon, category, sort_order) VALUES ('兴奋', 'zap', 'positive', 7)
    ON CONFLICT(name) DO NOTHING;
    INSERT INTO emotion_types (name, icon, category, sort_order) VALUES ('恐惧', 'shield-alert', 'negative', 8)
    ON CONFLICT(name) DO NOTHING;
  `)
}

export const connectSqlite = () => {
  if (sqliteDb) {
    return sqliteDb
  }

  const sqliteDbPath = resolveSqliteDbPath()
  ensureDirectory(sqliteDbPath)

  sqliteDb = new DatabaseSync(sqliteDbPath)
  sqliteDb.exec('PRAGMA foreign_keys = ON;')
  sqliteDb.exec('PRAGMA journal_mode = WAL;')
  initSchema(sqliteDb)

  return sqliteDb
}

export const getSqliteDb = () => {
  if (!sqliteDb) {
    return connectSqlite()
  }
  return sqliteDb
}

export const sqliteAll = (sqlText: string, params: any[] = []) => {
  const db = getSqliteDb()
  return db.prepare(sqlText).all(...params)
}

export const sqliteGet = (sqlText: string, params: any[] = []) => {
  const db = getSqliteDb()
  return db.prepare(sqlText).get(...params)
}

export const sqliteRun = (sqlText: string, params: any[] = []) => {
  const db = getSqliteDb()
  return db.prepare(sqlText).run(...params)
}

export const sqliteTransaction = <T>(operation: () => T): T => {
  const db = getSqliteDb()

  db.exec('BEGIN IMMEDIATE;')
  try {
    const result = operation()
    db.exec('COMMIT;')
    return result
  } catch (error) {
    db.exec('ROLLBACK;')
    throw error
  }
}
