$ErrorActionPreference = "Stop"
$wsUrl = "ws://127.0.0.1:9222/devtools/page/F2C005DCD42B809FB9679F5BF2D19857"
$exprPath = Join-Path (Resolve-Path ".").Path "_measure_expr.js"
$outPath = Join-Path (Resolve-Path ".").Path "_measure_out.json"
$expr = Get-Content -LiteralPath $exprPath -Raw -Encoding UTF8

Add-Type -AssemblyName System.Net.Http
$ws = New-Object System.Net.WebSockets.ClientWebSocket
$ct = [Threading.CancellationToken]::None
$ws.ConnectAsync([Uri]$wsUrl, $ct).GetAwaiter().GetResult()

function Send-Msg([hashtable]$obj) {
  $json = ($obj | ConvertTo-Json -Compress -Depth 40)
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
  $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).GetAwaiter().GetResult() | Out-Null
}

function Recv-UntilId([int]$wantId, [int]$max = 40) {
  for ($i = 0; $i -lt $max; $i++) {
    $ms = New-Object System.IO.MemoryStream
    $buffer = New-Object byte[] 262144
    do {
      $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buffer)
      $result = $ws.ReceiveAsync($seg, $ct).GetAwaiter().GetResult()
      $ms.Write($buffer, 0, $result.Count)
    } while (-not $result.EndOfMessage)
    $text = [Text.Encoding]::UTF8.GetString($ms.ToArray())
    $obj = $text | ConvertFrom-Json
    if ($null -ne $obj.id -and [int]$obj.id -eq $wantId) { return $obj }
  }
  throw "timeout waiting for id=$wantId"
}

# drain a bit
Send-Msg @{ id = 1; method = "Runtime.enable" }
[void](Recv-UntilId 1)
Send-Msg @{ id = 2; method = "Page.enable" }
[void](Recv-UntilId 2)

# Force 1920x1080 CSS viewport
Send-Msg @{
  id = 3
  method = "Emulation.setDeviceMetricsOverride"
  params = @{
    width = 1920
    height = 1080
    deviceScaleFactor = 1
    mobile = $false
  }
}
[void](Recv-UntilId 3)

# Reload to apply metrics cleanly
Send-Msg @{
  id = 4
  method = "Page.reload"
  params = @{ ignoreCache = $true }
}
[void](Recv-UntilId 4)

Start-Sleep -Seconds 2

# Wait for load event via evaluate
Send-Msg @{
  id = 5
  method = "Runtime.evaluate"
  params = @{
    expression = "(async()=>{ for(let i=0;i<50;i++){ if(document.readyState==='complete') break; await new Promise(r=>setTimeout(r,100)); } return document.readyState; })()"
    awaitPromise = $true
    returnByValue = $true
  }
}
$ready = Recv-UntilId 5
Write-Output ("ready=" + ($ready.result.result.value))

# Try enter battle if start UI exists
$enterExpr = @'
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const click = (sel) => {
    const el = document.querySelector(sel);
    if (el) { el.click(); return true; }
    return false;
  };
  // common entry points
  const candidates = [
    "#start-button", ".start-button", "#btn-start", "[data-action='start']",
    ".title-start", "#tutorial-skip", ".tutorial-skip",
    "button.start", "#play-button"
  ];
  for (const sel of candidates) click(sel);
  await sleep(200);
  // click any visible primary CTA text
  for (const el of Array.from(document.querySelectorAll("button, .btn, [role=button], a"))) {
    const t = (el.textContent || "").trim();
    if (/시작|게임 시작|START|플레이|이어하기|튜토리얼/.test(t)) {
      try { el.click(); } catch(e) {}
    }
  }
  await sleep(400);
  if (typeof setupBattleSideLayout === "function") {
    try { setupBattleSideLayout(); } catch(e) {}
  }
  if (typeof updateGameFitScale === "function") updateGameFitScale();
  return {
    hasRoot: !!document.getElementById("game-scale-root"),
    hasSidebar: !!document.querySelector(".battle-sidebar-left"),
    hasBoard: !!document.querySelector(".game-board-viewport"),
    hasRemove: !!document.getElementById("remove-button"),
    bodyClass: document.body.className
  };
})()
'@

Send-Msg @{
  id = 6
  method = "Runtime.evaluate"
  params = @{
    expression = $enterExpr
    awaitPromise = $true
    returnByValue = $true
  }
}
$enter = Recv-UntilId 6
Write-Output ("enter=" + ($enter.result.result | ConvertTo-Json -Compress -Depth 5))

Send-Msg @{
  id = 7
  method = "Runtime.evaluate"
  params = @{
    expression = $expr
    awaitPromise = $true
    returnByValue = $true
  }
}
$report = Recv-UntilId 7
$report | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $outPath -Encoding UTF8
Write-Output "wrote $outPath"
if ($report.result.exceptionDetails) {
  Write-Output ("EXC=" + ($report.result.exceptionDetails | ConvertTo-Json -Depth 8 -Compress))
} else {
  Write-Output ($report.result.result.value | ConvertTo-Json -Depth 20 -Compress)
}
$ws.Dispose()
