import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

// 初始化数据库
function getDb() {
  const dbPath = path.join(process.cwd(), 'referrals.db');
  const db = new Database(dbPath);
  
  // 创建表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT UNIQUE NOT NULL,
      referrer_address TEXT,
      team_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  return db;
}

export async function POST(request) {
  try {
    const { walletAddress, referrerAddress, teamName } = await request.json();

    if (!walletAddress || !teamName) {
      return NextResponse.json(
        { success: false, message: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 验证钱包地址格式
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json(
        { success: false, message: '无效的钱包地址格式' },
        { status: 400 }
      );
    }

    // 不能推荐自己
    if (referrerAddress && walletAddress.toLowerCase() === referrerAddress.toLowerCase()) {
      return NextResponse.json(
        { success: false, message: '不能推荐自己' },
        { status: 400 }
      );
    }

    const db = getDb();

    // 检查是否已经绑定
    const existingUser = db.prepare('SELECT * FROM users WHERE wallet_address = ?').get(walletAddress);
    
    if (existingUser) {
      db.close();
      return NextResponse.json(
        { success: false, message: '该钱包地址已经绑定过了', alreadyBound: true },
        { status: 400 }
      );
    }

    // 插入新用户
    const stmt = db.prepare(`
      INSERT INTO users (wallet_address, referrer_address, team_name)
      VALUES (?, ?, ?)
    `);

    try {
      stmt.run(walletAddress, referrerAddress || null, teamName);
      db.close();
      
      return NextResponse.json({
        success: true,
        message: '绑定成功'
      });
    } catch (err) {
      db.close();
      if (err.message.includes('UNIQUE constraint failed')) {
        return NextResponse.json(
          { success: false, message: '该钱包地址已经绑定过了', alreadyBound: true },
          { status: 400 }
        );
      }
      throw err;
    }
  } catch (error) {
    console.error('绑定失败:', error);
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    );
  }
}
