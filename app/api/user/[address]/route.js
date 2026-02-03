import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

function getDb() {
  const dbPath = path.join(process.cwd(), 'referrals.db');
  const db = new Database(dbPath);
  
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

export async function GET(request, { params }) {
  try {
    const { address } = params;
    const db = getDb();

    // 查询用户信息
    const user = db.prepare('SELECT * FROM users WHERE wallet_address = ?').get(address);

    if (!user) {
      db.close();
      return NextResponse.json({ exists: false });
    }

    // 如果用户是推荐人，获取其团队成员
    const teamMembers = db.prepare(`
      SELECT wallet_address, team_name, created_at 
      FROM users 
      WHERE referrer_address = ?
      ORDER BY created_at DESC
    `).all(address);

    db.close();

    return NextResponse.json({
      exists: true,
      user,
      teamMembers
    });
  } catch (error) {
    console.error('查询用户失败:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
