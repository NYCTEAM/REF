import { NextResponse } from 'next/server';
// 使用Redis数据库（如果REDIS_URL环境变量存在）或内存数据库
const useRedis = process.env.REDIS_URL ? true : false;
const db = useRedis 
  ? await import('../../../lib/redis-db.js').then(m => m.db)
  : await import('../../../lib/db.js').then(m => m.db);

export async function GET() {
  try {
    const stats = await db.getStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
