import { NextResponse } from 'next/server';
import { db } from '../../../lib/sqlite-db.js';

export const dynamic = 'force-dynamic'; // 确保不缓存，实时获取数据

export async function GET() {
  try {
    const teams = db.getTeams();
    return NextResponse.json(teams);
  } catch (error) {
    console.error('获取团队列表失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
