# Windows One-Click Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Windows BAT launcher start Docker-backed infrastructure and three visible application service windows, then open the browser only after all three services are reachable.

**Architecture:** Keep the BAT file as the user-facing dependency check and click entry point. Keep Docker, Compose, migrations, process environment, service spawning, and readiness polling in `start-project.ps1`; reuse the existing `mood-health-ccooddee` Compose project and dynamic published ports.

**Tech Stack:** Windows Batch, PowerShell 5+, Docker Desktop, Docker Compose, Node.js test runner, Vue/Vite, Node/Express, Python/FastAPI.

## Global Constraints

- Preserve three independent visible windows: Vue, Node API, and FastAPI AI.
- Start or reuse only Compose project `mood-health-ccooddee`; do not alter containers owned by other worktrees.
- Start Docker Desktop when the daemon is unavailable, then wait for MySQL and Redis health before migrations.
- Do not open the browser or report success until frontend `3001`, Node `/health`, and FastAPI `/api/health` are reachable.
- Preserve all unrelated dirty-worktree changes; stage only files named by each task.
- Commit each small test or implementation change separately.

---

### Task 1: Add readiness-polling contract tests

**Files:**
- Modify: `scripts/one-click-start.test.mjs`
- Test: `scripts/one-click-start.test.mjs`

**Interfaces:**
- Consumes: current launcher contents returned by `readLaunchers()`.
- Produces: static contract requiring `Wait-ServiceEndpoint`, three endpoint checks, a timeout error, and removal of BAT fixed-delay startup.

- [ ] **Step 1: Write the failing PowerShell readiness test**

Add assertions equivalent to:

```js
test('PowerShell waits for all application services before returning', async () => {
  const [, powershell] = await readLaunchers()

  assert.match(powershell, /function Wait-ServiceEndpoint/)
  assert.match(powershell, /http:\/\/127\.0\.0\.1:\$\{NodePort\}\/health/)
  assert.match(powershell, /http:\/\/127\.0\.0\.1:\$\{AiPort\}\/api\/health/)
  assert.match(powershell, /http:\/\/127\.0\.0\.1:\$\{FrontendPort\}\//)
  assert.match(powershell, /Timed out waiting for \$Name/)
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test scripts/one-click-start.test.mjs`

Expected: the new test fails because `Wait-ServiceEndpoint` is absent.

- [ ] **Step 3: Commit the failing contract test**

```powershell
git add -- scripts/one-click-start.test.mjs
git commit -m "test: require launcher service readiness checks"
```

---

### Task 2: Wait for all three services in PowerShell

**Files:**
- Modify: `start-project.ps1`
- Test: `scripts/one-click-start.test.mjs`

**Interfaces:**
- Consumes: `NodePort`, `AiPort`, and `FrontendPort` integer parameters.
- Produces: `Wait-ServiceEndpoint -Name <string> -Uri <string> -TimeoutSeconds <int>` which returns only after HTTP reachability or throws a timeout error.

- [ ] **Step 1: Implement the minimal readiness helper**

Add a function before process startup:

```powershell
function Wait-ServiceEndpoint {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Uri,
        [int]$TimeoutSeconds = 90
    )

    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Uri -TimeoutSec 3
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                Write-Host "$Name is ready: $Uri" -ForegroundColor Green
                return
            }
        } catch {
            Start-Sleep -Seconds 2
        }
    } while ([DateTime]::UtcNow -lt $deadline)

    throw "Timed out waiting for $Name at $Uri. Check the $Name service window for errors."
}
```

- [ ] **Step 2: Invoke the helper after spawning services**

Call it in dependency order:

```powershell
Wait-ServiceEndpoint -Name 'Node backend' -Uri "http://127.0.0.1:${NodePort}/health"
if (-not $NoAi) {
    Wait-ServiceEndpoint -Name 'FastAPI AI' -Uri "http://127.0.0.1:${AiPort}/api/health"
}
Wait-ServiceEndpoint -Name 'Vue frontend' -Uri "http://127.0.0.1:${FrontendPort}/"
```

Print the final success block only after these calls return.

- [ ] **Step 3: Run the contract test and verify GREEN**

Run: `node --test scripts/one-click-start.test.mjs`

Expected: all readiness-contract tests pass.

- [ ] **Step 4: Check PowerShell syntax**

Run:

```powershell
$errors = $null
[void][System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path 'start-project.ps1'), [ref]$null, [ref]$errors)
if ($errors.Count) { $errors | Format-List; exit 1 }
```

Expected: exit code 0 and no parser errors.

- [ ] **Step 5: Commit the PowerShell implementation**

```powershell
git add -- start-project.ps1
git commit -m "feat: wait for one-click services to become ready"
```

---

### Task 3: Remove fixed-delay browser opening

**Files:**
- Modify: `scripts/one-click-start.test.mjs`
- Modify: `启动大学生情绪健康管理平台.bat`
- Test: `scripts/one-click-start.test.mjs`

**Interfaces:**
- Consumes: successful exit from `start-project.ps1`, which now proves all service endpoints are reachable.
- Produces: browser opening immediately after verified readiness; failed PowerShell exit retains the existing actionable error and pause.

- [ ] **Step 1: Write the failing BAT behavior test**

Add:

```js
test('batch launcher opens the browser without a fixed readiness delay', async () => {
  const [batch] = await readLaunchers()

  assert.doesNotMatch(batch, /timeout \/t/i)
  assert.match(batch, /start "" "http:\/\/localhost:3001"/)
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test scripts/one-click-start.test.mjs`

Expected: failure because the current BAT contains `timeout /t 8`.

- [ ] **Step 3: Commit the failing BAT contract test**

```powershell
git add -- scripts/one-click-start.test.mjs
git commit -m "test: reject fixed launcher readiness delay"
```

- [ ] **Step 4: Implement the minimal BAT change**

Remove the fixed `timeout /t 8 /nobreak` line. Update the final English messages to state that infrastructure and all three services passed readiness checks before the browser was opened; keep ASCII-only BAT contents and the existing error-level/pause behavior.

- [ ] **Step 5: Run the contract test and verify GREEN**

Run: `node --test scripts/one-click-start.test.mjs`

Expected: all tests pass with zero failures.

- [ ] **Step 6: Commit the BAT implementation**

```powershell
git add -- '启动大学生情绪健康管理平台.bat'
git commit -m "feat: open app after verified startup"
```

---

### Task 4: Verify the real launcher path

**Files:**
- Verify only: `启动大学生情绪健康管理平台.bat`
- Verify only: `start-project.ps1`
- Verify only: `scripts/one-click-start.test.mjs`

**Interfaces:**
- Consumes: the completed launcher and a working local Docker Desktop installation.
- Produces: fresh static and runtime evidence; no code changes unless a new failing test first demonstrates a defect.

- [ ] **Step 1: Run full launcher contract verification**

Run: `node --test scripts/one-click-start.test.mjs`

Expected: all tests pass, zero failures.

- [ ] **Step 2: Run diff hygiene checks**

Run:

```powershell
git diff --check HEAD~4..HEAD
git status --short
```

Expected: no whitespace errors; unrelated existing dirty files remain unstaged.

- [ ] **Step 3: Execute the real click entry point**

Run: `cmd /d /c "启动大学生情绪健康管理平台.bat < nul"`

Expected: Docker Desktop becomes ready, Compose project `mood-health-ccooddee` reports healthy MySQL/Redis, migrations complete, and three service windows open. Redirected `pause` output is not treated as startup failure.

- [ ] **Step 4: Verify all health endpoints**

Run:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3001/
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/health
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8001/api/health
```

Expected: HTTP 200 from all three endpoints. If Docker or another external dependency prevents this step, report the exact error and do not claim runtime completion.
