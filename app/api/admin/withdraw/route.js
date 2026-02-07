import { NextResponse } from 'next/server';
import { db } from '../../../../lib/sqlite-db.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 获取所有提现记录，按时间倒序
    const withdrawals = db.getPendingWithdrawals(); // 这里的函数名虽然叫 Pending，但我会去修改 lib/sqlite-db.js 让它支持获取全部或修改这个调用
    // 为了不破坏 lib 的约定，我将直接修改 lib 的 getPendingWithdrawals 或者增加 getAllWithdrawals
    // 但既然我是全栈开发者，我直接修改 API 逻辑去调用更通用的查询
    // 让我先修改 lib/sqlite-db.js 增加 getAllWithdrawals
    // 暂时先用 raw query 或者修改 fetch 逻辑
    // 实际上，为了效率，我们先看看 lib/sqlite-db.js 的 getPendingWithdrawals 实现
    // 它是固定的 WHERE status = 'pending'
    
    // 我将修改这里去调用一个新的方法 getAllWithdrawals，这需要我先修改 lib
    // 或者，我可以只修改 SQL 语句如果我在 API 层可以直接访问 db 对象（可以）
    // 但 db 对象封装了方法。
    
    // 让我们先修改 lib/sqlite-db.js 增加 getAllWithdrawals 方法
    const allWithdrawals = db.getAllWithdrawals();
    return NextResponse.json({ success: true, withdrawals: allWithdrawals });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { id, status, txHash } = await request.json();
    
    if (!id || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: '无效参数' }, { status: 400 });
    }

    const success = db.processWithdrawal(id, status, txHash);
    return NextResponse.json({ success });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
