import { NextResponse } from 'next/server';
import { db } from '../../../lib/sqlite-db.js';

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
