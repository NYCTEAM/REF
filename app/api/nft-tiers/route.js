import { NextResponse } from 'next/server';
import { db } from '../../../lib/sqlite-db.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tiers = db.getNFTTiers();
    return NextResponse.json({ success: true, tiers });
  } catch (error) {
    console.error('获取 NFT 等级失败:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
