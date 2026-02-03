import { NextResponse } from 'next/server';
// 使用Redis数据库（如果REDIS_URL环境变量存在）或内存数据库
const useRedis = process.env.REDIS_URL ? true : false;
const db = useRedis 
  ? await import('../../../lib/redis-db.js').then(m => m.db)
  : await import('../../../lib/db.js').then(m => m.db);

export async function POST(request) {
  try {
    const { walletAddress, referrerAddress, teamName } = await request.json();

    if (!walletAddress || !teamName) {
      return NextResponse.json(
        { success: false, message: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 验证钱包地址格式
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json(
        { success: false, message: '无效的钱包地址格式' },
        { status: 400 }
      );
    }

    // 不能推荐自己
    if (referrerAddress && walletAddress.toLowerCase() === referrerAddress.toLowerCase()) {
      return NextResponse.json(
        { success: false, message: '不能推荐自己' },
        { status: 400 }
      );
    }

    // 绑定推荐关系
    const result = db.bindReferral(walletAddress, referrerAddress, teamName);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: '该钱包地址已经绑定过了', alreadyBound: true },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '绑定成功',
      data: { teamName }
    });
  } catch (error) {
    console.error('绑定失败:', error);
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    );
  }
}
