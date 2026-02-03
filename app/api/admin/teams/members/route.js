import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/sqlite-db.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const teamName = searchParams.get('teamName');
    
    if (!teamName) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
    }

    const members = db.getTeamMembers(teamName);
    return NextResponse.json({ success: true, members });
  } catch (error) {
    console.error('获取团队成员失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
