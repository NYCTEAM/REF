import { NextResponse } from 'next/server';
import { db } from '../../../lib/sqlite-db.js';

export const dynamic = 'force-dynamic'; // 强制不缓存，确保获取实时数据

export async function GET() {
  try {
    console.log('=== 开始获取统计数据 ===');
    const stats = db.getStats();
    console.log('统计数据结果:', JSON.stringify(stats, null, 2));
    return NextResponse.json(stats);
  } catch (error) {
    console.error('获取统计数据失败:', error);
    console.error('错误堆栈:', error.stack);
    return NextResponse.json(
      { error: '服务器错误', message: error.message },
      { status: 500 }
    );
  }
}
