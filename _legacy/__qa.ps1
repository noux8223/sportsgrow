$ErrorActionPreference = "Stop"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$profile = "C:\Users\loveu\AppData\Local\Temp\opencode\chrome-cdp"
$outDir = "C:\Users\loveu\AppData\Local\Temp\opencode\qa"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
Start-Sleep -Milliseconds 500

$chromeProc = Start-Process -FilePath $chrome -ArgumentList @(
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
  "--no-default-browser-check", "--remote-debugging-port=9333",
  "--user-data-dir=$profile", "--force-device-scale-factor=1", "about:blank"
) -PassThru
Start-Sleep -Seconds 3

$targets = Invoke-RestMethod "http://127.0.0.1:9333/json"
$pageTarget = $targets | Where-Object { $_.type -eq "page" } | Select-Object -First 1
$ws = [System.Net.WebSockets.ClientWebSocket]::new()
$ws.ConnectAsync([Uri]$pageTarget.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait()

$script:msgId = 0
function Send-Cdp($method, $params, $sessionId) {
  $script:msgId++
  $msg = @{ id = $script:msgId; method = $method; params = $params }
  if ($sessionId) { $msg.sessionId = $sessionId }
  $json = $msg | ConvertTo-Json -Compress -Depth 12
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $seg = [ArraySegment[byte]]::new($bytes)
  $ws.SendAsync($seg, [Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).Wait()
  return $script:msgId
}

function Receive-Cdp {
  $buf = New-Object byte[] 4194304
  $sb = New-Object Text.StringBuilder
  do {
    $res = $ws.ReceiveAsync([ArraySegment[byte]]::new($buf), [Threading.CancellationToken]::None).Result
    [void]$sb.Append([Text.Encoding]::UTF8.GetString($buf, 0, $res.Count))
  } while (-not $res.EndOfMessage)
  return ($sb.ToString() | ConvertFrom-Json)
}

function Wait-Cdp($id) {
  while ($true) {
    $m = Receive-Cdp
    if ($m.id -eq $id) { return $m }
  }
}

function Call-Cdp($method, $params, $sessionId) {
  $id = Send-Cdp $method $params $sessionId
  return Wait-Cdp $id
}

function Eval-Js($expr, $sessionId) {
  $r = Call-Cdp "Runtime.evaluate" @{ expression = $expr; returnByValue = $true; awaitPromise = $true } $sessionId
  return $r.result.result.value
}

function Shot($name, $sessionId) {
  $r = Call-Cdp "Page.captureScreenshot" @{ format = "png"; fromSurface = $true } $sessionId
  $bytes = [Convert]::FromBase64String($r.result.data)
  [IO.File]::WriteAllBytes((Join-Path $outDir "$name.png"), $bytes)
}

function Set-Viewport($w, $h, $mobile, $sessionId) {
  Call-Cdp "Emulation.setDeviceMetricsOverride" @{
    width = $w; height = $h; deviceScaleFactor = 1; mobile = $mobile
    screenWidth = $w; screenHeight = $h
  } $sessionId | Out-Null
}

function Scroll-To($selector, $sessionId) {
  $expr = "(() => { const el = document.querySelector('$selector'); if (!el) return -1; const top = el.getBoundingClientRect().top + window.scrollY - 76; window.scrollTo({top, behavior:'instant'}); return Math.round(window.scrollY); })()"
  return Eval-Js $expr $sessionId
}

$attach = Call-Cdp "Target.attachToTarget" @{ targetId = $pageTarget.id; flatten = $true } $null
$session = $attach.result.sessionId
Call-Cdp "Page.enable" @{} $session | Out-Null
Call-Cdp "Runtime.enable" @{} $session | Out-Null

$uri = ([System.Uri](Join-Path $PSScriptRoot "index.html")).AbsoluteUri

Set-Viewport 1440 900 $false $session
Call-Cdp "Page.navigate" @{ url = $uri } $session | Out-Null
Start-Sleep -Seconds 3
Shot "desk-top" $session

$sections = @("value","problem","features","preview","difference","safety","model","validation","summary")
foreach ($s in $sections) {
  $y = Scroll-To "#$s" $session
  Start-Sleep -Milliseconds 900
  Shot "desk-$s" $session
}

Scroll-To "#preview" $session | Out-Null
Start-Sleep -Milliseconds 600
foreach ($tab in @("training","game","report")) {
  Eval-Js "document.getElementById('tab-$tab').click(); 'ok'" $session | Out-Null
  Start-Sleep -Milliseconds 700
  Shot "desk-tab-$tab" $session
}
Eval-Js "document.getElementById('tab-profile').click(); 'ok'" $session | Out-Null

Set-Viewport 390 844 $true $session
Start-Sleep -Seconds 1
Eval-Js "window.scrollTo({top:0, behavior:'instant'}); 'ok'" $session | Out-Null
Start-Sleep -Milliseconds 800
Shot "mob-top" $session

$metrics = Eval-Js @"
JSON.stringify({
  innerWidth: window.innerWidth,
  innerHeight: window.innerHeight,
  scrollWidth: document.documentElement.scrollWidth,
  bodyScrollWidth: document.body.scrollWidth,
  hero: (() => { const r = document.querySelector('.hero').getBoundingClientRect(); return {left:r.left,right:r.right,width:r.width}; })(),
  heroVisual: (() => { const r = document.querySelector('.hero__visual').getBoundingClientRect(); return {left:r.left,right:r.right,width:r.width}; })(),
  dash: (() => { const r = document.querySelector('.dash').getBoundingClientRect(); return {left:r.left,right:r.right,width:r.width}; })(),
  overflowEls: [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > 391).slice(0, 12).map(el => (el.className || el.tagName) + ':' + Math.round(el.getBoundingClientRect().right))
})
"@ $session
[IO.File]::WriteAllText((Join-Path $outDir "metrics.json"), $metrics)

foreach ($s in @("value","features","preview","safety","model","validation","summary")) {
  Scroll-To "#$s" $session | Out-Null
  Start-Sleep -Milliseconds 900
  Shot "mob-$s" $session
}

Set-Viewport 768 1024 $true $session
Start-Sleep -Seconds 1
Eval-Js "window.scrollTo({top:0, behavior:'instant'}); 'ok'" $session | Out-Null
Start-Sleep -Milliseconds 800
Shot "tab-top" $session
Scroll-To "#preview" $session | Out-Null
Start-Sleep -Milliseconds 900
Shot "tab-preview" $session

$ws.Dispose()
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*chrome-cdp*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
"QA_DONE"
Get-Content (Join-Path $outDir "metrics.json")
