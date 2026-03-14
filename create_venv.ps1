<#
  一键创建虚拟环境脚本
  执行后会在当前目录生成.venv文件夹，并安装项目核心依赖
#>

Write-Color([string]"==================== 创建虚拟环境 ====================") -Color Cyan

# 检查Python是否安装
try {
    python --version | Out-Null
} catch {
    Write-Color([string]"❌ 未检测到Python，请先安装Python并添加到环境变量！") -Color Red
    Read-Host "按任意键退出"
    exit 1
}

# 1. 创建.venv虚拟环境
Write-Color([string]"🔧 正在创建虚拟环境 .venv...") -Color Yellow
python -m venv .venv

# 检查是否创建成功
if (-not (Test-Path ".venv")) {
    Write-Color([string]"❌ 虚拟环境创建失败！") -Color Red
    Read-Host "按任意键退出"
    exit 1
}
Write-Color([string]"✅ .venv 文件夹已创建") -Color Green

# 2. 激活虚拟环境并安装核心依赖
Write-Color([string]"🔧 正在激活环境并安装依赖...") -Color Yellow
.\.venv\Scripts\Activate.ps1

# 更新pip
python -m pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple

# 安装项目核心依赖（含CUDA版PyTorch）
pip install modelscope==1.9.5 transformers==4.35.2 accelerate==0.24.1 fastapi uvicorn -i https://pypi.tuna.tsinghua.edu.cn/simple
pip install torch==2.1.0 torchvision==0.16.0 torchaudio==2.1.0 --index-url https://download.pytorch.org/whl/cu118

# 导出依赖清单
pip freeze > requirements.txt

Write-Color([string]"✅ 所有依赖安装完成，requirements.txt已生成") -Color Green

# 3. 验证环境
Write-Color([string]"🔧 验证PyTorch + CUDA...") -Color Yellow
python -c "import torch; 
print('PyTorch版本:', torch.__version__);
print('CUDA是否可用:', torch.cuda.is_available());
print('✅ 环境创建完成！')"

Write-Color([string]"======================================================") -Color Cyan
Write-Color([string]"👉 后续维护请运行 venv_manage.ps1 脚本") -Color Yellow
Read-Host "按任意键退出"