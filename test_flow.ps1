$base = 'http://localhost:3000'
$jar = Join-Path $PSScriptRoot 'cookies_desktop.txt'
if (Test-Path $jar) { Remove-Item $jar }

# 1) Desktop: create challenge
$ch = curl.exe -s -c $jar "$base/api/qr/challenge" | ConvertFrom-Json
Write-Host "[1] challenge -> ok=$($ch.ok) code=$($ch.code) token=$($ch.token) qrBytes=$($ch.qr.Length)"

# 2) Phone: verify code with a student profile
$vbody = Join-Path $PSScriptRoot 'vbody.json'
Set-Content -Path $vbody -Value ('{"code":"' + $ch.code + '","studentId":"stu-1001"}') -Encoding ASCII -NoNewline
$v = curl.exe -s -X POST "$base/api/qr/verify" -H 'Content-Type: application/json' -d "@$vbody" | ConvertFrom-Json
Write-Host "[2] verify    -> ok=$($v.ok) student=$($v.student.name)"

# 3) Desktop: poll status (binds session cookie)
$s = curl.exe -s -b $jar "$base/api/qr/status?token=$($ch.token)" | ConvertFrom-Json
Write-Host "[3] status    -> $($s.status) student=$($s.student.name)"

# 4) Desktop: open dashboard with session
$code = curl.exe -s -b $jar -o NUL -w '%{http_code}' "$base/dashboard"
Write-Host "[4] /dashboard (authed) -> HTTP $code"

# 5) Video list
$vl = curl.exe -s "$base/api/videos" | ConvertFrom-Json
Write-Host "[5] videos    -> $($vl.videos.Count) : $($vl.videos -join ', ')"

# 6) Range-request the video (streaming support)
$vr = curl.exe -s -H 'Range: bytes=0-2047' -D - -o NUL "$base/api/video/1"
$vrHeaders = ($vr -split "`r?`n") | Where-Object { $_ -match '^HTTP|^Content-Range|^Content-Type' }
Write-Host "[6] video     -> $($vrHeaders -join ' | ')"

# 7) Progress save + read
$pbody = Join-Path $PSScriptRoot 'pbody.json'
Set-Content -Path $pbody -Value '{"videoId":"video1.mp4","progress":42,"position":120}' -Encoding ASCII -NoNewline
$ps = curl.exe -s -X PUT "$base/api/progress/alex.johnson%40westmont.edu" -H 'Content-Type: application/json' -d "@$pbody" | ConvertFrom-Json
$pg = curl.exe -s "$base/api/progress/alex.johnson%40westmont.edu" | ConvertFrom-Json
Write-Host "[7] progress  -> saved=$($ps.ok) read=$($pg['video1.mp4'].progress)%"