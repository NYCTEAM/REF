import { NextResponse } from 'next/server';
import { db } from '../../../lib/sqlite-db.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 获取推荐人排名（按直推业绩排序）
    const ranking = db.getReferrerRanking();
    
    return NextResponse.json({
      success: true,
      data: ranking
    });
  } catch (error) {
    console.error('获取推荐人排名失败:', error);
    return NextResponse.json(
      { success: false, message: '获取排名失败' },
      { status: 500 }
    );
  }
}
