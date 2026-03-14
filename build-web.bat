@echo off
setlocal

REM 切换到脚本所在目录（项目根目录）
cd /d "%~dp0"

echo ==========================================
echo  大学生情绪健康前端项目 - 构建脚本
echo  1) 安装依赖
echo  2) 打包构建（npm run build）
echo ==========================================
echo.

echo [1/2] 正在安装依赖（npm install）...
npm install
if %errorlevel% neq 0 (
  echo.
  echo 安装依赖失败，构建终止。请检查网络或 npm 源。
  exit /b %errorlevel%
)

echo.
echo [2/2] 正在执行构建（npm run build）...
npm run build
if %errorlevel% neq 0 (
  echo.
  echo 构建失败，请查看上方错误信息。
  exit /b %errorlevel%
)

echo.
echo 构建完成！构建结果已输出到 dist\ 目录。

endlocal
