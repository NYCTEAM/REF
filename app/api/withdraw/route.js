import { NextResponse } from 'next/server';
import { db } from '../../../lib/sqlite-db.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { walletAddress, amount } = await request.json();

    if (!walletAddress || !amount || amount <= 0) {
      return NextResponse.json({ success: false, message: '无效的参数' }, { status: 400 });
    }

    // 这里应该有更多的服务端验证（例如重新计算佣金确认余额），但在 MVP 中我们先信任前端计算或简单记录
    // 理想情况下：Server calculate available commission = (TotalSales * Rate) - Claimed
    // 由于我们没有在后端实时同步链上数据，这里暂时只记录工单，由管理员审核时核对

    const result = db.createWithdrawal(walletAddress, amount);
    
    return NextResponse.json({ 
      success: true, 
      message: '提现申请已提交，等待审核',
      id: result.id
    });
  } catch (error) {
    console.error('提现申请失败:', error);
    return NextResponse.json({ success: false, message: '提交失败' }, { status: 500 });
  }
}
