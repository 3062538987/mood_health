$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$outFile = Join-Path $root '毕业设计咨询聊天整理_2026-05-25.docx'
$tmp = Join-Path $root '.docx_build_tmp'

if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
New-Item -ItemType Directory -Path $tmp | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tmp '_rels') | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tmp 'word') | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tmp 'word\_rels') | Out-Null

$contentTypes = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
'@
$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $tmp '[Content_Types].xml'), $contentTypes, $utf8)

$rels = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
'@
[System.IO.File]::WriteAllText((Join-Path $tmp '_rels\.rels'), $rels, $utf8)

$docRels = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>
'@
[System.IO.File]::WriteAllText((Join-Path $tmp 'word\_rels\document.xml.rels'), $docRels, $utf8)

$lines = @(
'Mood Health Graduation Project - Chat Summary',
'Date: 2026-05-25',
'',
'1) Project Basics (from user)',
'Project title: Research on the Current Situation and Improvement of College Students Emotional Health in the Social Media Era.',
'Positioning: Interdisciplinary graduation project combining psychology research, product design, and empirical investigation.',
'Goal: Build a closed loop of research analysis, theory support, intervention plan, and product implementation.',
'',
'2) User Questions in this conversation',
'Q1. Provide a full 11-module graduation-design level framework suitable for thesis, proposal, mid-term check, and defense PPT.',
'Q2. Explain the technical stack and how each part is implemented.',
'Q3. Explain API details, layered architecture, and end-to-end technical chain (frontend input to frontend output).',
'Q4. Organize all Q and A into a Word document in the repository root.',
'',
'3) Key response points for Q1',
'- Research background and significance under social media context.',
'- Project overview: target users, scenarios, objectives, and research logic.',
'- Three modules: empirical study, group intervention, and online product.',
'- Methods: literature review, questionnaire, interview, mixed-method analysis.',
'- Architecture and modular decoupling for reusability and scalability.',
'- Data/content system, key difficulties, innovation points, and limitations with future plan.',
'',
'4) Key response points for Q2 (Tech Stack + Implementation)',
'- Frontend: Vue 3 + TypeScript + Vite for component UI, routing, state, and charts.',
'- Backend: Node/Express and Python/FastAPI coexist.',
'- Data: SQLite for structured records, Redis for cache/status.',
'- AI strategy: local fallback plus optional service integration.',
'- Deployment: Nginx + PM2 + script-based startup and release.',
'',
'5) Key response points for Q3 (API + Layers + Technical Chain)',
'- API domains: Auth, Mood, Questionnaire, Post, Activity, and FastAPI Assessment/Treehole.',
'- Layering: Presentation -> API adapter -> Gateway/middleware -> Domain services -> Data layer.',
'- Login chain: form input -> /api/auth/login -> token -> Authorization header -> /api/auth/me.',
'- Mood chain: input -> /api/moods/record -> validation/storage -> report/trend -> frontend chart output.',
'- Questionnaire chain: load questions -> submit answers -> scoring -> result and history rendering.',
'',
'6) Suggested thesis-ready conclusion',
'The project integrates empirical research, group intervention, and digital product implementation into one closed loop. It combines academic rigor with practical service delivery through a layered and modular technical architecture.',
'',
'7) Optional next deliverables',
'- Full proposal draft',
'- Thesis chapter template',
'- Mid-term review template',
'- Defense PPT script and QandA preparation'
)

$paragraphs = New-Object System.Collections.Generic.List[string]
foreach ($line in $lines) {
  $escaped = [System.Security.SecurityElement]::Escape($line)
  $paragraphs.Add("<w:p><w:r><w:t xml:space='preserve'>$escaped</w:t></w:r></w:p>") | Out-Null
}

$bodyXml = ($paragraphs -join "`n")
$documentXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14">
  <w:body>
$bodyXml
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
      <w:cols w:space="708"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>
"@
[System.IO.File]::WriteAllText((Join-Path $tmp 'word\document.xml'), $documentXml, $utf8)

if (Test-Path $outFile) { Remove-Item -Force $outFile }
$zipFile = "$outFile.zip"
if (Test-Path $zipFile) { Remove-Item -Force $zipFile }
Compress-Archive -Path (Join-Path $tmp '*') -DestinationPath $zipFile -Force
Move-Item -Path $zipFile -Destination $outFile -Force
Remove-Item -Recurse -Force $tmp

Write-Output "CREATED: $outFile"
