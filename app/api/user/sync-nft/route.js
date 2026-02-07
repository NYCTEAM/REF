import { NextResponse } from 'next/server';
import { db } from '../../../../lib/sqlite-db.js';

export async function POST(request) {
  try {
    const { walletAddress, nftCount, mintAmount } = await request.json();

    if (!walletAddress) {
      return NextResponse.json({ success: false, message: 'Missing address' }, { status: 400 });
    }

    const success = db.updateUserNftStats(walletAddress, nftCount || 0, mintAmount || 0);
    
    return NextResponse.json({ success });
  } catch (error) {
    console.error('Update NFT stats failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
