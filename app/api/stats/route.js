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

export async function GET() {
  try {
    const db = getDb();

    // 总用户数
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

    // 有推荐人的用户数
    const usersWithReferrer = db.prepare('SELECT COUNT(*) as count FROM users WHERE referrer_address IS NOT NULL').get().count;

    // 团队分布
    const teams = db.prepare('SELECT team_name, COUNT(*) as member_count FROM users GROUP BY team_name').all();

    // 所有用户
    const allUsers = db.prepare('SELECT wallet_address, referrer_address, team_name, created_at FROM users ORDER BY created_at DESC').all();

    // 推荐人排名
    const referrerRanking = db.prepare(`
      SELECT 
        referrer_address,
        COUNT(*) as referral_count,
        MIN(created_at) as first_referral_time
      FROM users 
      WHERE referrer_address IS NOT NULL 
      GROUP BY referrer_address 
      ORDER BY referral_count DESC, first_referral_time ASC
    `).all();

    db.close();

    return NextResponse.json({
      totalUsers,
      usersWithReferrer,
      teams,
      allUsers,
      referrerRanking
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
