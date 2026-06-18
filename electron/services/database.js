import path from 'path';
import { app } from 'electron';
import { fileURLToPath } from 'url';

let Database = null;
import('better-sqlite3').then(m => { Database = m.default; }).catch(() => { console.warn('better-sqlite3 不可用'); });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 数据库实例
let db = null;

// 模拟数据库（当 better-sqlite3 不可用时）
function createMockDb() {
  const noop = () => ({ get: () => null, run: () => ({ lastInsertRowid: 0 }) });
  return {
    prepare: () => noop(),
    pragma: () => {},
    exec: () => {},
    close: () => {}
  };
}

// 初始化数据库
export async function initDatabase() {
  if (!Database) {
    console.warn('SQLite 不可用，跳过数据库初始化');
    db = createMockDb();
    return db;
  }
  try {
    // 确定数据库路径
    const dbPath = app?.isPackaged
      ? path.join(app.getPath('userData'), 'toefl_data.db')
      : path.join(__dirname, '../../toefl_data.db');

    console.log('数据库路径:', dbPath);

    // 创建数据库连接
    db = new Database(dbPath, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : null
    });

    // 启用WAL模式提高性能
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');

    // 创建表
    await createTables();

    console.log('数据库初始化完成');
    return db;
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  }
}

// 创建表
async function createTables() {
  const tables = [
    // 用户表
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // 许可证表
    `CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_key TEXT UNIQUE NOT NULL,
      license_type TEXT NOT NULL, -- 'trial', 'perpetual', 'subscription'
      status TEXT NOT NULL, -- 'active', 'expired', 'revoked'
      user_id INTEGER,
      activation_date DATETIME,
      expiration_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`,

    // 模块表
    `CREATE TABLE IF NOT EXISTS modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      description TEXT,
      enabled BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // 用户答案表
    `CREATE TABLE IF NOT EXISTS user_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      module_id INTEGER NOT NULL,
      question_id TEXT NOT NULL,
      answer TEXT NOT NULL,
      is_correct BOOLEAN,
      score INTEGER,
      time_spent INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (module_id) REFERENCES modules (id),
      UNIQUE(user_id, module_id, question_id)
    )`,

    // 用户进度表
    `CREATE TABLE IF NOT EXISTS user_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      module_id INTEGER NOT NULL,
      total_questions INTEGER DEFAULT 0,
      completed_questions INTEGER DEFAULT 0,
      total_score INTEGER DEFAULT 0,
      total_time_spent INTEGER DEFAULT 0,
      last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (module_id) REFERENCES modules (id),
      UNIQUE(user_id, module_id)
    )`,

    // 设置表
    `CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      category TEXT DEFAULT 'general',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  // 执行所有表创建语句
  const createTablesTransaction = db.transaction(() => {
    tables.forEach(sql => {
      db.prepare(sql).run();
    });
  });

  createTablesTransaction();

  // 插入默认模块数据
  await seedDefaultData();
}

// 插入默认数据
async function seedDefaultData() {
  const modules = [
    ['reading', '阅读模块', '托福阅读练习模块'],
    ['listening', '听力模块', '托福听力练习模块'],
    ['speaking', '口语模块', '托福口语练习模块'],
    ['writing', '写作模块', '托福写作练习模块']
  ];

  const insertModule = db.prepare(`
    INSERT OR IGNORE INTO modules (name, display_name, description) 
    VALUES (?, ?, ?)
  `);

  modules.forEach(module => {
    insertModule.run(module);
  });
}

// 获取数据库实例
export function getDatabase() {
  if (!db) {
    throw new Error('数据库未初始化，请先调用 initDatabase()');
  }
  return db;
}

// 关闭数据库连接
export async function closeDatabase() {
  if (db) {
    try {
      db.close();
      db = null;
      console.log('数据库连接已关闭');
    } catch (error) {
      console.error('关闭数据库连接失败:', error);
      throw error;
    }
  }
}

// 用户相关操作
export const userService = {
  // 创建或获取用户
  createOrGetUser(deviceId) {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO users (device_id) 
      VALUES (?)
    `);

    const result = stmt.run(deviceId);

    const getUser = db.prepare('SELECT * FROM users WHERE device_id = ?');
    return getUser.get(deviceId);
  },

  // 更新用户最后登录时间
  updateLastLogin(userId) {
    const stmt = db.prepare(`
      UPDATE users 
      SET last_login = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    return stmt.run(userId);
  }
};

// 答案相关操作
export const answerService = {
  // 保存用户答案
  saveAnswer(userId, moduleId, questionId, answer, isCorrect = null, score = null, timeSpent = 0) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO user_answers 
      (user_id, module_id, question_id, answer, is_correct, score, time_spent, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    return stmt.run(userId, moduleId, questionId, answer, isCorrect, score, timeSpent);
  },

  // 获取用户答案
  getAnswer(userId, moduleId, questionId) {
    const stmt = db.prepare(`
      SELECT * FROM user_answers 
      WHERE user_id = ? AND module_id = ? AND question_id = ?
    `);

    return stmt.get(userId, moduleId, questionId);
  },

  // 获取用户所有答案
  getUserAnswers(userId, moduleId) {
    const stmt = db.prepare(`
      SELECT * FROM user_answers 
      WHERE user_id = ? AND module_id = ?
      ORDER BY created_at DESC
    `);

    return stmt.all(userId, moduleId);
  },

  // 删除用户答案
  deleteAnswer(userId, moduleId, questionId) {
    const stmt = db.prepare(`
      DELETE FROM user_answers 
      WHERE user_id = ? AND module_id = ? AND question_id = ?
    `);

    return stmt.run(userId, moduleId, questionId);
  }
};

// 进度相关操作
export const progressService = {
  // 更新用户进度
  updateProgress(userId, moduleId, completedIncrement = 0, scoreIncrement = 0, timeIncrement = 0) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO user_progress 
      (user_id, module_id, completed_questions, total_score, total_time_spent, updated_at) 
      VALUES (?, ?, 
        COALESCE((SELECT completed_questions FROM user_progress WHERE user_id = ? AND module_id = ?), 0) + ?,
        COALESCE((SELECT total_score FROM user_progress WHERE user_id = ? AND module_id = ?), 0) + ?,
        COALESCE((SELECT total_time_spent FROM user_progress WHERE user_id = ? AND module_id = ?), 0) + ?,
        CURRENT_TIMESTAMP
      )
    `);

    return stmt.run(
      userId,
      moduleId,
      userId,
      moduleId,
      completedIncrement,
      userId,
      moduleId,
      scoreIncrement,
      userId,
      moduleId,
      timeIncrement
    );
  },

  // 获取用户进度
  getProgress(userId, moduleId) {
    const stmt = db.prepare(`
      SELECT * FROM user_progress 
      WHERE user_id = ? AND module_id = ?
    `);

    return stmt.get(userId, moduleId);
  },

  // 获取所有模块进度
  getAllProgress(userId) {
    const stmt = db.prepare(`
      SELECT up.*, m.display_name as module_name 
      FROM user_progress up
      JOIN modules m ON up.module_id = m.id
      WHERE up.user_id = ?
    `);

    return stmt.all(userId);
  }
};

// 设置相关操作
export const settingsService = {
  // 获取设置
  getSetting(key) {
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    const result = stmt.get(key);
    return result ? result.value : null;
  },

  // 设置值
  setSetting(key, value, category = 'general') {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, category, updated_at) 
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `);

    return stmt.run(key, value, category);
  },

  // 获取分类下的所有设置
  getSettingsByCategory(category) {
    const stmt = db.prepare('SELECT key, value FROM settings WHERE category = ?');
    return stmt.all(category);
  },

  // 删除设置
  deleteSetting(key) {
    const stmt = db.prepare('DELETE FROM settings WHERE key = ?');
    return stmt.run(key);
  }
};

// 导出数据
export async function exportUserData(userId) {
  const data = {
    user: null,
    answers: [],
    progress: [],
    settings: []
  };

  // 获取用户信息
  const getUser = db.prepare('SELECT * FROM users WHERE id = ?');
  data.user = getUser.get(userId);

  // 获取用户答案
  const getAnswers = db.prepare(`
    SELECT ua.*, m.name as module_name 
    FROM user_answers ua
    JOIN modules m ON ua.module_id = m.id
    WHERE ua.user_id = ?
  `);
  data.answers = getAnswers.all(userId);

  // 获取用户进度
  const getProgress = db.prepare(`
    SELECT up.*, m.name as module_name 
    FROM user_progress up
    JOIN modules m ON up.module_id = m.id
    WHERE up.user_id = ?
  `);
  data.progress = getProgress.all(userId);

  // 获取用户设置
  data.settings = settingsService.getSettingsByCategory(`user_${userId}`);

  return data;
}

// 导入数据
export async function importUserData(userId, data) {
  const transaction = db.transaction(() => {
    // 导入答案
    if (data.answers && Array.isArray(data.answers)) {
      data.answers.forEach(answer => {
        answerService.saveAnswer(
          userId,
          answer.module_id,
          answer.question_id,
          answer.answer,
          answer.is_correct,
          answer.score,
          answer.time_spent
        );
      });
    }

    // 导入进度
    if (data.progress && Array.isArray(data.progress)) {
      data.progress.forEach(progress => {
        progressService.updateProgress(
          userId,
          progress.module_id,
          progress.completed_questions,
          progress.total_score,
          progress.total_time_spent
        );
      });
    }

    // 导入设置
    if (data.settings && Array.isArray(data.settings)) {
      data.settings.forEach(setting => {
        settingsService.setSetting(
          setting.key,
          setting.value,
          setting.category || `user_${userId}`
        );
      });
    }
  });

  transaction();
}

// 备份数据库
export async function backupDatabase(backupPath) {
  if (!db) {
    throw new Error('数据库未初始化');
  }

  const backupDb = new Database(backupPath);
  db.backup(backupDb, {
    progress: ({ totalPages, remainingPages }) => {
      const progress = ((totalPages - remainingPages) / totalPages) * 100;
      console.log(`备份进度: ${progress.toFixed(2)}%`);
    }
  });

  backupDb.close();
  console.log('数据库备份完成:', backupPath);
}
