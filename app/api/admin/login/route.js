import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // 管理员账号配置 (存储在后端，前端无法查看)
    const ADMIN_CREDENTIALS = {
      email: 'cibi18@gmail.com',
      password: 'Cb800828'
    };

    // 验证逻辑
    if (email && 
        email.toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase() && 
        password === ADMIN_CREDENTIALS.password) {
      
      // 登录成功
      return NextResponse.json({ success: true });
    } else {
      // 登录失败
      return NextResponse.json({ success: false, message: '账号或密码错误' }, { status: 401 });
    }
  } catch (error) {
    console.error('登录出错:', error);
    return NextResponse.json({ success: false, message: '服务器内部错误' }, { status: 500 });
  }
}
