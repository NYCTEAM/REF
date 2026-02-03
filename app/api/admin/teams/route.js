import { NextResponse } from 'next/server';
import { db } from '../../../../lib/sqlite-db.js';

// 获取所有团队列表 (管理员视角)
export async function GET() {
  try {
    const teams = db.getTeams();
    return NextResponse.json({ success: true, teams });
  } catch (error) {
    console.error('获取团队列表失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 创建新团队
export async function POST(request) {
  try {
    const { name, leaderAddress, description } = await request.json();
    
    if (!name) {
      return NextResponse.json({ error: '团队名称不能为空' }, { status: 400 });
    }

    const result = db.addTeam(name, leaderAddress, description);
    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    console.error('创建团队失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 删除团队
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'ID不能为空' }, { status: 400 });
    }

    const success = db.deleteTeam(id);
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: '团队不存在或删除失败' }, { status: 404 });
    }
  } catch (error) {
    console.error('删除团队失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
