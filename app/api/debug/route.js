import { NextResponse } from 'next/server';
import { db } from '../../../lib/sqlite-db.js';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data');
    const DB_FILE = path.join(DB_PATH, 'referrals.db');
    
    console.log('=== 数据库调试信息 ===');
    console.log('DB_PATH 环境变量:', process.env.DB_PATH);
    console.log('实际数据库路径:', DB_FILE);
    
    // 检查文件是否存在
    const fs = require('fs');
    const dbExists = fs.existsSync(DB_FILE);
    console.log('数据库文件是否存在:', dbExists);
    
    if (dbExists) {
      const stats = fs.statSync(DB_FILE);
      console.log('数据库文件大小:', stats.size, 'bytes');
      console.log('数据库文件修改时间:', stats.mtime);
    }
    
    // 直接查询数据库
    const Database = require('better-sqlite3');
    const database = new Database(DB_FILE);
    
    // 获取所有表
    const tables = database.prepare(`
      SELECT name FROM sqlite_master WHERE type='table'
    `).all();
    console.log('数据库表:', tables);
    
    // 获取users表的所有数据
    const users = database.prepare('SELECT * FROM users').all();
    console.log('users表数据:', users);
    
    // 获取统计信息
    const stats = db.getStats();
    
    database.close();
    
    return NextResponse.json({
      dbPath: DB_FILE,
      dbExists,
      dbSize: dbExists ? fs.statSync(DB_FILE).size : 0,
      tables,
      usersCount: users.length,
      users,
      stats
    });
  } catch (error) {
    console.error('调试API错误:', error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
