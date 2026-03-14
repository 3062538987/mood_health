<#
  大学生情绪健康管理平台 - 虚拟环境维护脚本
  使用说明：
  1. 以管理员身份打开PowerShell
  2. 先执行：Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
  3. 然后执行：.\venv_manage.ps1
  4. 根据菜单选择对应操作即可
#>

# 定义颜色输出，方便查看
function Write-Color([string]$Text, [string]$Color) {
    Write-Host $Text -ForegroundColor $Color
}

# ========== 新增：解决PowerShell执行策略问题 ==========
# 检查并提示执行策略设置
$executionPolicy = Get-ExecutionPolicy -Scope CurrentUser
if ($executionPolicy -eq "Restricted") {
    Clear-Host
    Write-Color "⚠️  PowerShell执行策略限制，需要先解除限制！" "Yellow"
    Write-Color "请在管理员PowerShell中执行以下命令，然后重新运行本脚本：" "White"
    Write-Color "Set-ExecutionPolicy RemoteSigned -Scope CurrentUser" "Cyan"
    Write-Color "执行后输入 Y 确认即可" "White"
    Read-Host "`n按任意键退出"
    exit 1
}

# 检查是否在项目根目录（是否有.venv文件夹）
if (-not (Test-Path ".venv")) {
    Clear-Host
    Write-Color "❌ 未找到虚拟环境 .venv，请先创建！" "Red"
    Write-Color "创建虚拟环境命令：python -m venv .venv" "Yellow"
    Write-Color "注意：需要先安装Python并添加到系统环境变量" "White"
    Read-Host "`n按任意键退出"  # 新增暂停，避免秒退
    exit 1
}

# 主菜单
while ($true) {
    Clear-Host
    Write-Color "==================== 虚拟环境维护菜单 ====================" "Cyan"
    Write-Color "1. 激活虚拟环境" "Green"
    Write-Color "2. 安装/更新项目依赖（从requirements.txt）" "Green"
    Write-Color "3. 导出当前依赖到requirements.txt" "Green"
    Write-Color "4. 查看已安装的依赖包" "Green"
    Write-Color "5. 清理pip缓存（释放磁盘空间）" "Green"
    Write-Color "6. 验证PyTorch + CUDA是否正常" "Green"
    Write-Color "7. 退出脚本" "Red"
    Write-Color "======================================================" "Cyan"
    
    $choice = Read-Host "请输入操作编号（1-7）"
    
    switch ($choice) {
        1 {
            Write-Color "🔧 正在激活虚拟环境..." "Yellow"
            .\.venv\Scripts\Activate.ps1
            Write-Color "✅ 虚拟环境已激活（命令行前显示(.venv)）" "Green"
            Write-Color "👉 退出虚拟环境请执行：deactivate" "Yellow"
            Read-Host "按任意键返回菜单"
        }
        2 {
            Write-Color "🔧 正在激活虚拟环境并安装依赖..." "Yellow"
            .\.venv\Scripts\Activate.ps1
            python -m pip install --upgrade pip
            # 新增：检查requirements.txt是否存在
            if (Test-Path "requirements.txt") {
                pip install -r requirements.txt
            } else {
                Write-Color "⚠️  未找到requirements.txt，跳过该文件安装" "Yellow"
            }
            # 强制安装CUDA版PyTorch（核心依赖）
            pip install torch==2.1.0 torchvision==0.16.0 torchaudio==2.1.0 --index-url https://download.pytorch.org/whl/cu118
            Write-Color "✅ 依赖安装/更新完成" "Green"
            Read-Host "按任意键返回菜单"
        }
        3 {
            Write-Color "🔧 正在激活虚拟环境并导出依赖..." "Yellow"
            .\.venv\Scripts\Activate.ps1
            pip freeze > requirements.txt
            Write-Color "✅ 依赖已导出到 requirements.txt" "Green"
            Write-Color "👉 文件路径：$(Get-Location)\requirements.txt" "Yellow"
            Read-Host "按任意键返回菜单"
        }
        4 {
            Write-Color "🔧 正在激活虚拟环境并查看依赖..." "Yellow"
            .\.venv\Scripts\Activate.ps1
            pip list
            Write-Color "`n✅ 依赖列表已显示" "Green"
            Read-Host "按任意键返回菜单"
        }
        5 {
            Write-Color "🔧 正在清理pip缓存..." "Yellow"
            .\.venv\Scripts\Activate.ps1
            pip cache purge
            Write-Color "✅ pip缓存清理完成" "Green"
            Read-Host "按任意键返回菜单"
        }
        6 {
            Write-Color "🔧 正在验证PyTorch + CUDA..." "Yellow"
            .\.venv\Scripts\Activate.ps1
            python -c "import torch; 
print('PyTorch版本:', torch.__version__);
print('CUDA是否可用:', torch.cuda.is_available());
print('CUDA版本:', torch.version.cuda if torch.cuda.is_available() else '未检测到');
print('显卡名称:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else '无GPU')"
            Write-Color "`n✅ 验证完成（CUDA可用显示True即为正常）" "Green"
            Read-Host "按任意键返回菜单"
        }
        7 {
            Write-Color "👋 退出脚本，再见！" "Cyan"
            exit 0
        }
        default {
            Write-Color "❌ 输入无效，请输入1-7之间的数字！" "Red"
            Read-Host "按任意键返回菜单"
        }
    }
}