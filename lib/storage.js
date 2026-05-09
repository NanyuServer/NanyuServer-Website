// 智能存储适配器 - 自动选择使用数据库或文件系统
const fs = require('fs');
const path = require('path');

const isProduction = process.env.VERCEL || process.env.VERCEL_ENV;

class StorageAdapter {
  constructor() {
    this.useDatabase = false;
    this.useFileSystem = !isProduction;
    this.feedbackFile = path.join(__dirname, '../data/feedback.json');
    this.db = null;
    
    if (process.env.DATABASE_URL && isProduction) {
      this.useDatabase = true;
      this.useFileSystem = false;
      this.initDatabase();
    }
  }

  initDatabase() {
    try {
      const { Pool } = require('@neondatabase/serverless');
      this.db = new Pool({ connectionString: process.env.DATABASE_URL });
      console.log('Database adapter initialized');
      
      // 异步初始化表结构
      this.ensureTable().catch(err => {
        console.error('Failed to ensure table:', err);
      });
    } catch (error) {
      console.error('Failed to initialize database:', error);
      this.useDatabase = false;
      this.useFileSystem = true;
    }
  }

  async ensureTable() {
    if (!this.db) return;
    
    try {
      const client = await this.db.connect();
      
      try {
        // 创建反馈表（如果不存在）
        await client.query(`
          CREATE TABLE IF NOT EXISTS feedback (
            id VARCHAR(255) PRIMARY KEY,
            type VARCHAR(50) NOT NULL,
            message TEXT NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            reply TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
        
        // 创建索引（如果不存在）
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
        `);
        
        console.log('Feedback table initialized successfully');
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error ensuring table:', error);
      // 不要让表创建失败导致整个系统崩溃
    }
  }

  async read() {
    if (this.useDatabase && this.db) {
      return await this.readFromDatabase();
    } else if (this.useFileSystem) {
      return this.readFromFileSystem();
    } else {
      // Fallback: return empty array and log error
      console.error('No storage backend available');
      return [];
    }
  }

  async write(data) {
    if (this.useDatabase && this.db) {
      return await this.writeToDatabase(data);
    } else if (this.useFileSystem) {
      return this.writeToFileSystem(data);
    } else {
      throw new Error('No storage backend available');
    }
  }

  // File System Operations
  readFromFileSystem() {
    try {
      this.ensureFileSystem();
      const data = fs.readFileSync(this.feedbackFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading from file system:', error);
      return [];
    }
  }

  writeToFileSystem(data) {
    try {
      this.ensureFileSystem();
      fs.writeFileSync(this.feedbackFile, JSON.stringify(data, null, 2));
      return { success: true };
    } catch (error) {
      console.error('Error writing to file system:', error);
      return { success: false, error: error.message };
    }
  }

  ensureFileSystem() {
    const dataDir = path.join(__dirname, '../data');
    
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    if (!fs.existsSync(this.feedbackFile)) {
      fs.writeFileSync(this.feedbackFile, JSON.stringify([], null, 2));
    }
  }

  // Database Operations
  async readFromDatabase() {
    try {
      // 确保表存在
      await this.ensureTable();
      
      const result = await this.db.query(
        'SELECT id, type, message, status, reply, created_at as "createdAt", updated_at as "updatedAt" FROM feedback ORDER BY created_at DESC'
      );
      return result.rows.map(row => ({
        id: row.id,
        type: row.type,
        message: row.message,
        status: row.status,
        reply: row.reply || '',
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString()
      }));
    } catch (error) {
      console.error('Error reading from database:', error);
      // 如果是表不存在错误，尝试创建表
      if (error.message.includes('does not exist')) {
        try {
          await this.ensureTable();
          return [];
        } catch (tableError) {
          console.error('Failed to create table:', tableError);
          return [];
        }
      }
      return [];
    }
  }

  async writeToDatabase(data) {
    try {
      // 确保表存在
      await this.ensureTable();
      
      const client = await this.db.connect();
      
      try {
        // Clear existing data and insert new
        await client.query('DELETE FROM feedback');
        
        for (const item of data) {
          await client.query(
            'INSERT INTO feedback (id, type, message, status, reply, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [item.id, item.type, item.message, item.status, item.reply, new Date(item.createdAt), new Date(item.updatedAt)]
          );
        }
        
        return { success: true };
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error writing to database:', error);
      // 如果是表不存在错误，尝试创建表
      if (error.message.includes('does not exist')) {
        try {
          await this.ensureTable();
          return { success: false, error: '表已创建，请重试' };
        } catch (tableError) {
          console.error('Failed to create table:', tableError);
          return { success: false, error: tableError.message };
        }
      }
      return { success: false, error: error.message };
    }
  }
}

module.exports = new StorageAdapter();
