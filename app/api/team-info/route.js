import { NextResponse } from 'next/server';
import { db } from '../../../lib/sqlite-db.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    const team = db.getTeamByLeader(address);
    
    if (team) {
      return NextResponse.json({ success: true, team });
    } else {
      return NextResponse.json({ success: false, message: 'Team not found' }, { status: 404 });
    }

  } catch (error) {
    console.error('获取团队信息失败:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
