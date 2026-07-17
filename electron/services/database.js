import path from 'path';
import { app } from 'electron';
import { fileURLToPath } from 'url';

let databaseConstructorPromise;

function loadDatabaseConstructor() {
  databaseConstructorPromise ??= import('better-sqlite3')
    .then(module => module.default)
    .catch(error => {
      databaseConstructorPromise = undefined;
      throw new Error('The SQLite extension is not installed. Add better-sqlite3 to enable it.', {
        cause: error
      });
    });
  return databaseConstructorPromise;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Database instance
let db = null;
let initializationPromise;

// Initialize the database.
export function initDatabase() {
  if (initializationPromise) return initializationPromise;
  if (db) return db;
  initializationPromise ??= (async () => {
    try {
      const Database = await loadDatabaseConstructor();
      const dbPath = app?.isPackaged
        ? path.join(app.getPath('userData'), 'toefl_data.db')
        : path.join(__dirname, '../../toefl_data.db');

      const connection = new Database(dbPath, {
        verbose: process.env.NODE_ENV === 'development' ? console.log : null
      });
      db = connection;
      connection.pragma('journal_mode = WAL');
      connection.pragma('synchronous = NORMAL');
      connection.pragma('foreign_keys = ON');
      await createTables();
      return connection;
    } catch (error) {
      db?.close();
      db = null;
      throw error;
    } finally {
      initializationPromise = undefined;
    }
  })();
  return initializationPromise;
}

// Create database tables.
async function createTables() {
  const tables = [
    // Users
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Licenses
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

    // Practice modules
    `CREATE TABLE IF NOT EXISTS modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      description TEXT,
      enabled BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // User answers
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

    // User progress
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

    // Settings
    `CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      category TEXT DEFAULT 'general',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  // Create all tables in one transaction.
  const createTablesTransaction = db.transaction(() => {
    tables.forEach(sql => {
      db.prepare(sql).run();
    });
  });

  createTablesTransaction();

  // Seed the default modules.
  await seedDefaultData();
}

// Seed default data.
async function seedDefaultData() {
  const modules = [
    ['reading', 'Reading', 'TOEFL reading practice'],
    ['listening', 'Listening', 'TOEFL listening practice'],
    ['speaking', 'Speaking', 'TOEFL speaking practice'],
    ['writing', 'Writing', 'TOEFL writing practice']
  ];

  const insertModule = db.prepare(`
    INSERT OR IGNORE INTO modules (name, display_name, description) 
    VALUES (?, ?, ?)
  `);

  modules.forEach(module => {
    insertModule.run(module);
  });
}

// Get the database instance.
export function getDatabase() {
  if (!db) {
    throw new Error('The database is not initialized. Call initDatabase() first.');
  }
  return db;
}

// Close the database connection.
export async function closeDatabase() {
  if (db) {
    try {
      db.close();
      db = null;
      console.log('Database connection closed.');
    } catch (error) {
      console.error('Could not close the database connection:', error);
      throw error;
    }
  }
}

// User operations
export const userService = {
  // Create or retrieve a user.
  createOrGetUser(deviceId) {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO users (device_id) 
      VALUES (?)
    `);

    const result = stmt.run(deviceId);

    const getUser = db.prepare('SELECT * FROM users WHERE device_id = ?');
    return getUser.get(deviceId);
  },

  // Update the user's last login time.
  updateLastLogin(userId) {
    const stmt = db.prepare(`
      UPDATE users 
      SET last_login = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    return stmt.run(userId);
  }
};

// Answer operations
export const answerService = {
  // Save an answer.
  saveAnswer(userId, moduleId, questionId, answer, isCorrect = null, score = null, timeSpent = 0) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO user_answers 
      (user_id, module_id, question_id, answer, is_correct, score, time_spent, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    return stmt.run(userId, moduleId, questionId, answer, isCorrect, score, timeSpent);
  },

  // Get one answer.
  getAnswer(userId, moduleId, questionId) {
    const stmt = db.prepare(`
      SELECT * FROM user_answers 
      WHERE user_id = ? AND module_id = ? AND question_id = ?
    `);

    return stmt.get(userId, moduleId, questionId);
  },

  // Get all answers for a module.
  getUserAnswers(userId, moduleId) {
    const stmt = db.prepare(`
      SELECT * FROM user_answers 
      WHERE user_id = ? AND module_id = ?
      ORDER BY created_at DESC
    `);

    return stmt.all(userId, moduleId);
  },

  // Delete an answer.
  deleteAnswer(userId, moduleId, questionId) {
    const stmt = db.prepare(`
      DELETE FROM user_answers 
      WHERE user_id = ? AND module_id = ? AND question_id = ?
    `);

    return stmt.run(userId, moduleId, questionId);
  }
};

// Progress operations
export const progressService = {
  // Update module progress.
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

  // Get module progress.
  getProgress(userId, moduleId) {
    const stmt = db.prepare(`
      SELECT * FROM user_progress 
      WHERE user_id = ? AND module_id = ?
    `);

    return stmt.get(userId, moduleId);
  },

  // Get progress across all modules.
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

// Settings operations
export const settingsService = {
  // Get one setting.
  getSetting(key) {
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    const result = stmt.get(key);
    return result ? result.value : null;
  },

  // Set a value.
  setSetting(key, value, category = 'general') {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, category, updated_at) 
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `);

    return stmt.run(key, value, category);
  },

  // Get all settings in a category.
  getSettingsByCategory(category) {
    const stmt = db.prepare('SELECT key, value FROM settings WHERE category = ?');
    return stmt.all(category);
  },

  // Delete a setting.
  deleteSetting(key) {
    const stmt = db.prepare('DELETE FROM settings WHERE key = ?');
    return stmt.run(key);
  }
};

// Export data.
export async function exportUserData(userId) {
  const data = {
    user: null,
    answers: [],
    progress: [],
    settings: []
  };

  // Read the user record.
  const getUser = db.prepare('SELECT * FROM users WHERE id = ?');
  data.user = getUser.get(userId);

  // Read user answers.
  const getAnswers = db.prepare(`
    SELECT ua.*, m.name as module_name 
    FROM user_answers ua
    JOIN modules m ON ua.module_id = m.id
    WHERE ua.user_id = ?
  `);
  data.answers = getAnswers.all(userId);

  // Read user progress.
  const getProgress = db.prepare(`
    SELECT up.*, m.name as module_name 
    FROM user_progress up
    JOIN modules m ON up.module_id = m.id
    WHERE up.user_id = ?
  `);
  data.progress = getProgress.all(userId);

  // Read user settings.
  data.settings = settingsService.getSettingsByCategory(`user_${userId}`);

  return data;
}

// Import data.
export async function importUserData(userId, data) {
  const transaction = db.transaction(() => {
    // Import answers.
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

    // Import progress.
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

    // Import settings.
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

// Back up the database.
export async function backupDatabase(backupPath) {
  if (!db) {
    throw new Error('The database is not initialized.');
  }

  await db.backup(backupPath, {
    progress: ({ totalPages, remainingPages }) => {
      const progress = ((totalPages - remainingPages) / totalPages) * 100;
      console.log(`Backup progress: ${progress.toFixed(2)}%`);
    }
  });
  console.log('Database backup complete:', backupPath);
}
