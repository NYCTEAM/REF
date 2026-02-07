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

    // 首先检查是否为团队长
    let team = db.getTeamByLeader(address);
    
    if (team) {
      return NextResponse.json({ success: true, team });
    }
    
    // 如果不是团队长，检查是否为普通用户
    const userInfo = db.getUserInfo(address);
    if (userInfo && userInfo.exists && userInfo.user.team_name) {
      // 返回用户所属团队的信息
      return NextResponse.json({ 
        success: true, 
        team: { 
          name: userInfo.user.team_name,
          leader_address: null, // 普通用户没有 leader_address
          description: null
        } 
      });
    }
    
    // 都不是，返回 404
    return NextResponse.json({ success: false, message: 'Team not found' }, { status: 404 });

  } catch (error) {
    console.error('获取团队信息失败:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
