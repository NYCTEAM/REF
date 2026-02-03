import { NextResponse } from 'next/server';
import { db } from '../../../../lib/sqlite-db.js';

export async function GET(request, { params }) {
  try {
    const { address } = params;
    const result = db.getUserInfo(address);
    return NextResponse.json(result);
  } catch (error) {
    console.error('查询用户失败:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
