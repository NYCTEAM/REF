@echo off
echo ========================================
echo 推送代码到 GitHub
echo ========================================
echo.

REM 检查是否已经初始化Git
if not exist .git (
    echo 初始化Git仓库...
    git init
    echo.
)

echo 添加所有文件...
git add .
echo.

echo 请输入提交信息 (直接回车使用默认信息):
set /p commit_msg="提交信息: "
if "%commit_msg%"=="" set commit_msg=Update: Vercel deployment ready

echo.
echo 提交更改...
git commit -m "%commit_msg%"
echo.

REM 检查是否已添加远程仓库
git remote | findstr origin >nul
if errorlevel 1 (
    echo 添加远程仓库...
    git remote add origin https://github.com/NYCTEAM/REF.git
    echo.
)

echo 设置主分支...
git branch -M main
echo.

echo 推送到GitHub...
git push -u origin main
echo.

if errorlevel 1 (
    echo.
    echo ========================================
    echo 推送失败！
    echo ========================================
    echo.
    echo 可能的原因：
    echo 1. 需要先在GitHub创建仓库
    echo 2. 需要配置Git凭据
    echo 3. 网络连接问题
    echo.
    echo 请手动执行以下命令：
    echo git push -u origin main
    echo.
) else (
    echo.
    echo ========================================
    echo 推送成功！
    echo ========================================
    echo.
    echo 下一步：
    echo 1. 访问 https://vercel.com
    echo 2. 点击 "New Project"
    echo 3. 导入 GitHub 仓库: NYCTEAM/REF
    echo 4. 点击 "Deploy"
    echo.
)

pause
