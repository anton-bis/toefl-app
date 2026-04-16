@echo off
chcp 65001 >nul
echo ========================================
echo   托福阅读测试页面HTTP服务器启动脚本
echo ========================================
echo.
echo 正在启动HTTP服务器...
echo.
echo 请勿关闭此窗口，测试页面需要此服务器运行
echo.
echo 浏览器将自动打开测试页面
echo 如果没有自动打开，请手动访问：
echo   http://localhost:8000/test-parser-flow.html
echo.
echo 按 Ctrl+C 停止服务器
echo ========================================
echo.

REM 检查Python是否可用
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo 使用Python启动HTTP服务器...
    echo.
    start "" "http://localhost:8000/test-parser-flow.html"
    python -m http.server 8000
) else (
    REM 检查Node.js是否可用
    node --version >nul 2>&1
    if %errorlevel% equ 0 (
        echo Python未找到，使用Node.js启动HTTP服务器...
        echo 正在安装http-server（首次运行需要联网）...
        npm list -g http-server >nul 2>&1
        if %errorlevel% neq 0 (
            npm install -g http-server
        )
        echo.
        start "" "http://localhost:8000/test-parser-flow.html"
        npx http-server -p 8000
    ) else (
        echo 错误：未找到Python或Node.js！
        echo 请安装以下之一：
        echo   1. Python 3.x（推荐）
        echo   2. Node.js
        echo.
        pause
        exit /b 1
    )
)