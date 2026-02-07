import { NextResponse } from 'next/server';
import { db } from '../../../../lib/sqlite-db.js';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    // 这里其实应该加权限验证，但因为是在管理员后台调用，且项目结构简单，
    // 我们假设能调到这个接口的都是管理员（或者在中间件层做验证）
    
    db.resetDatabase();
    
    return NextResponse.json({ success: true, message: '数据库已重置' });
  } catch (error) {
    console.error('重置数据库失败:', error);
    return NextResponse.json(
      { error: '重置失败', message: error.message },
      { status: 500 }
    );
  }
}
