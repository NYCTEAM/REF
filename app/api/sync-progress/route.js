import { NextResponse } from 'next/server';
import { db } from '../../../lib/sqlite-db.js';

export const dynamic = 'force-dynamic';

// 获取用户同步进度
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    const progress = db.getSyncProgress(address);
    return NextResponse.json({ success: true, progress });
  } catch (error) {
    console.error('获取同步进度失败:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// 更新同步进度
export async function POST(request) {
  try {
    const { address, lastBlock, nftCount, status } = await request.json();

    if (!address || !lastBlock) {
      return NextResponse.json({ error: 'Address and lastBlock are required' }, { status: 400 });
    }

    db.updateSyncProgress(address, lastBlock, nftCount || 0, status || 'completed');
    return NextResponse.json({ success: true, message: '同步进度已更新' });
  } catch (error) {
    console.error('更新同步进度失败:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// 重置同步进度
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    db.resetSyncProgress(address);
    return NextResponse.json({ success: true, message: '同步进度已重置' });
  } catch (error) {
    console.error('重置同步进度失败:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
