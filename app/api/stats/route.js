import { NextResponse } from 'next/server';
import { db } from '../../../lib/sqlite-db.js';

export async function GET() {
  try {
    const stats = db.getStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
