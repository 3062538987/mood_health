# GitHub 提交与发布命令（PowerShell）

## 1. 适用范围

- 仓库：`3062538987/mood_health`
- 工作目录：`D:\桌面\Code\大学生情绪健康\mood-health-web`
- 当前发布分支：`codex/r0-phase-a`
- 目标分支：`master`
- 本次只提交明确属于 R0 Phase A 的变更；`docs/architecture/`、`docs/superpowers/`、`file/`、`tasks/plan.md` 和 `tasks/R0-mysql-migration-plan.md` 保持未跟踪，不使用 `git add .`。

## 2. 发布前安全检查

```powershell
$ErrorActionPreference = 'Stop'
$Repo = 'D:\桌面\Code\大学生情绪健康\mood-health-web'
$Branch = 'codex/r0-phase-a'
$Base = 'origin/master'

Set-Location -LiteralPath $Repo

# 确认当前分支、工作区和远端；输出中不应出现意外的已修改文件。
git branch --show-current
git status --short
git remote -v

# 同步远端引用，但不修改本地工作区文件。
git fetch --prune origin

# 查看将进入 PR 的提交、文件统计与空白错误。
git log --oneline "$Base..HEAD"
git diff --stat "$Base...HEAD"
git diff --check "$Base...HEAD"
```

## 3. 运行验证

```powershell
# R0 新增契约测试：性能基线脚本 + PM2 进程名一致性。
node --test scripts/performance-baseline.test.mjs scripts/pm2-contract.test.mjs

# 前后端生产构建。
npm run build:all

# 环境诊断。端口未启动属于允许记录的警告，不应伪装成通过运行态检查。
npm run doctor

# 全量测试用于复核既有失败基线；如失败，应如实记录，不得使用 --force 绕过。
npm run test:all
```

## 4. 精确暂存与提交

```powershell
# 禁止 git add .；逐项列出本次允许提交的路径。
git add -- docs/refactor/GitHub-publish-commands.md

# 暂存后必须检查文件名和完整差异。
git diff --cached --name-status
git diff --cached

# 仅在暂存内容正确时提交。
git commit -m "docs: document GitHub publish commands"

# 再次确认没有把用户资料或未批准文档纳入提交。
git status -sb
git log --oneline "$Base..HEAD"
```

## 5. 推送功能分支

如果 HTTPS 推送提示无法读取用户名，而系统已安装 Git Credential Manager，可先为当前仓库启用凭据管理器并完成一次浏览器授权：

```powershell
Set-Location -LiteralPath 'D:\桌面\Code\大学生情绪健康\mood-health-web'

# 只修改当前仓库的 .git/config，不影响其他仓库。
git config --local credential.helper manager

# 打开 GitHub 官方授权页；在浏览器中确认账号和仓库写入授权。
# 不要把密码或 Personal Access Token 粘贴到聊天中。
git credential-manager github login --browser --username '3062538987'

# 登录后可用只读命令确认远端访问恢复。
git ls-remote origin HEAD
```

如果浏览器登录无法打开，可改用设备码流程：

```powershell
git credential-manager github login --device --username '3062538987'
```

完成授权后执行推送：

```powershell
# 首次推送并建立上游跟踪关系。
git push --set-upstream origin $Branch

# 验证本地 HEAD 与远端功能分支一致。
$LocalSha = git rev-parse HEAD
$RemoteSha = git rev-parse "origin/$Branch"
if ($LocalSha -ne $RemoteSha) {
    throw "推送校验失败：本地 $LocalSha，远端 $RemoteSha"
}
Write-Output "推送成功：$LocalSha"
```

## 6. 创建草稿 PR

当前环境已安装 GitHub CLI 2.96.0，并通过 GitHub 官方设备授权完成登录。以下命令是本次实际采用的草稿 PR 创建方式。

```powershell
$PrBody = @'
## 变更摘要

- 记录 R0 工程、测试和性能前置基线
- 保留 SQLite 离线备份校验清单，停止跟踪本地运行产物
- 统一 PM2 进程名为 mood-health-server，并增加契约测试
- 提交 Checkpoint A 报告和详细发布命令

## 验证

- 新增契约测试：8/8 通过
- npm run build:all：通过
- npm run doctor：0 个错误；未启动端口为已知警告
- npm run test:all：保留并披露既有失败基线，不宣称全量测试通过

## 边界

- 不修改旧 SQLite 数据内容
- 不提交 file/ 用户资料
- 性能数据不是 2 核 2G 环境结果，不宣称性能提升
- Phase A 完成后停在 Checkpoint A，不进入 Phase B
'@

gh pr create `
  --repo '3062538987/mood_health' `
  --base 'master' `
  --head 'codex/r0-phase-a' `
  --title 'R0 Phase A: establish baseline and repository hygiene' `
  --body $PrBody `
  --draft
```

## 7. 发布后核验

```powershell
git status -sb
git log --oneline --decorate -6
git ls-remote --heads origin $Branch

# 安装 gh 后可进一步检查 PR。
gh pr view --repo '3062538987/mood_health' --web
```
