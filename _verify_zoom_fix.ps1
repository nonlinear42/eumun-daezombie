$ErrorActionPreference = "Stop"
$proj = (Resolve-Path ".").Path
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$cdpPort = 9336
$userData = Join-Path $env:TEMP "eumun-cdp-9336"
New-Item -ItemType Directory -Force -Path $userData | Out-Null
$indexUrl = ([Uri](Join-Path $proj "index.html")).AbsoluteUri

function Escape-JsonString([string]$s) {
  $sb = New-Object System.Text.StringBuilder
  foreach ($ch in $s.ToCharArray()) {
    switch ($ch) {
      '"' { [void]$sb.Append('\"') }
      '\' { [void]$sb.Append('\\') }
      "`n" { [void]$sb.Append('\n') }
      "`r" { [void]$sb.Append('\r') }
      "`t" { [void]$sb.Append('\t') }
      default {
        $code = [int]$ch
        if ($code -lt 0x20) { [void]$sb.AppendFormat('\u{0:x4}', $code) } else { [void]$sb.Append($ch) }
      }
    }
  }
  return $sb.ToString()
}

Add-Type @"
using System;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.IO;
public class CdpVerify : IDisposable {
  ClientWebSocket ws = new ClientWebSocket();
  public void Connect(string url) { ws.ConnectAsync(new Uri(url), CancellationToken.None).GetAwaiter().GetResult(); }
  public string Call(string sendJson, int wantId, int timeoutMs) {
    var bytes = Encoding.UTF8.GetBytes(sendJson);
    ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None).GetAwaiter().GetResult();
    var deadline = DateTime.UtcNow.AddMilliseconds(timeoutMs);
    while (DateTime.UtcNow < deadline) {
      var ms = new MemoryStream(); var buf = new byte[2*1024*1024]; WebSocketReceiveResult result;
      do {
        var remain = (int)(deadline - DateTime.UtcNow).TotalMilliseconds;
        if (remain <= 0) throw new TimeoutException("timeout");
        using (var cts = new CancellationTokenSource(Math.Max(1, remain))) {
          result = ws.ReceiveAsync(new ArraySegment<byte>(buf), cts.Token).GetAwaiter().GetResult();
        }
        ms.Write(buf, 0, result.Count);
      } while (!result.EndOfMessage);
      var text = Encoding.UTF8.GetString(ms.ToArray());
      if (text.IndexOf("\"id\":" + wantId) >= 0) return text;
    }
    throw new TimeoutException("no id");
  }
  public void Dispose() { try { ws.Dispose(); } catch {} }
}
"@

$alive = $false
try { $null = Invoke-WebRequest "http://127.0.0.1:$cdpPort/json/version" -UseBasicParsing -TimeoutSec 1; $alive = $true } catch {}
if (-not $alive) {
  Start-Process -FilePath $chrome -ArgumentList @(
    "--headless=new","--disable-gpu","--remote-debugging-port=$cdpPort",
    "--user-data-dir=$userData","--window-size=1920,1080",$indexUrl
  ) | Out-Null
  Start-Sleep -Seconds 2.5
}

$raw = (Invoke-WebRequest "http://127.0.0.1:$cdpPort/json/list" -UseBasicParsing).Content
$tabs = $raw | ConvertFrom-Json
$wsUrl = $null
foreach ($t in $tabs) { if ($t.type -eq "page" -and $t.url -match "index") { $wsUrl = [string]$t.webSocketDebuggerUrl; break } }
if (-not $wsUrl) { foreach ($t in $tabs) { if ($t.type -eq "page") { $wsUrl = [string]$t.webSocketDebuggerUrl; break } } }

$cdp = New-Object CdpVerify
$cdp.Connect($wsUrl)
$id = 1
[void]$cdp.Call('{"id":1,"method":"Runtime.enable"}', 1, 8000)
$id = 2

$sizes = @(
  @{w=1366;h=768},
  @{w=1536;h=864},
  @{w=1920;h=1080}
)

$verifyExpr = @'
(() => {
  if (typeof updateGameFitScale === "function") updateGameFitScale();
  if (typeof setupBattleSideLayout === "function") { try { setupBattleSideLayout(); } catch(e) {} }
  if (typeof updateGameFitScale === "function") updateGameFitScale();
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const root = document.getElementById("game-scale-root");
  const layout = document.querySelector(".battle-layout");
  const board = document.querySelector(".game-board-viewport");
  const sidebar = document.querySelector(".battle-sidebar-left");
  const remove = document.getElementById("remove-button");
  const hud = document.querySelector(".status-bar");
  const lane5 = document.querySelector('.playfield-start-marker[data-row="4"]');
  const tr = getComputedStyle(root).transform;
  const scale = parseFloat((/matrix\(([^,]+)/.exec(tr)||[])[1]||"1");
  function ov(el){
    if(!el) return null;
    const r = el.getBoundingClientRect();
    return {
      bottom: Math.max(0, +(r.bottom - vh).toFixed(2)),
      right: Math.max(0, +(r.right - vw).toFixed(2)),
      top: Math.max(0, +(0 - r.y).toFixed(2)),
      left: Math.max(0, +(0 - r.x).toFixed(2)),
      rectBottom: +r.bottom.toFixed(2),
      effScaleY: el.offsetHeight ? +(r.height/el.offsetHeight).toFixed(5) : null
    };
  }
  const scroll = {
    docX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    docY: document.documentElement.scrollHeight > document.documentElement.clientHeight,
    bodyX: document.body.scrollWidth > document.body.clientWidth,
    bodyY: document.body.scrollHeight > document.body.clientHeight
  };
  return {
    viewport: {w:vw,h:vh},
    rootScale: +scale.toFixed(6),
    layoutZoom: layout ? getComputedStyle(layout).zoom : null,
    media1900: window.matchMedia("(min-width: 1900px)").matches,
    overflow: {
      root: ov(root),
      board: ov(board),
      sidebar: ov(sidebar),
      remove: ov(remove),
      hud: ov(hud),
      lane5: ov(lane5)
    },
    scroll,
    ok: (
      ov(root).bottom===0 && ov(root).right===0 &&
      ov(board).bottom===0 && ov(sidebar).bottom===0 && ov(remove).bottom===0 &&
      ov(hud).bottom===0 &&
      (!lane5 || ov(lane5).bottom===0) &&
      !scroll.docX && !scroll.docY
    )
  };
})()
'@

foreach ($sz in $sizes) {
  $id++
  [void]$cdp.Call(('{"id":'+$id+',"method":"Emulation.setDeviceMetricsOverride","params":{"width":'+$sz.w+',"height":'+$sz.h+',"deviceScaleFactor":1,"mobile":false}}'), $id, 8000)
  $id++
  [void]$cdp.Call(('{"id":'+$id+',"method":"Page.navigate","params":{"url":"'+(Escape-JsonString $indexUrl)+'"}}'), $id, 15000)
  Start-Sleep -Seconds 2
  $id++
  $boot = Get-Content (Join-Path $proj "_boot_expr.js") -Raw -Encoding UTF8
  [void]$cdp.Call(('{"id":'+$id+',"method":"Runtime.evaluate","params":{"expression":"'+(Escape-JsonString $boot)+'","awaitPromise":true,"returnByValue":true}}'), $id, 20000)
  Start-Sleep -Milliseconds 400
  $id++
  $res = $cdp.Call(('{"id":'+$id+',"method":"Runtime.evaluate","params":{"expression":"'+(Escape-JsonString $verifyExpr)+'","returnByValue":true}}'), $id, 20000)
  $j = $res | ConvertFrom-Json
  $v = $j.result.result.value
  Write-Output ("==== {0}x{1} ok={2} scale={3} layoutZoom={4} media1900={5}" -f $sz.w,$sz.h,$v.ok,$v.rootScale,$v.layoutZoom,$v.media1900)
  Write-Output ("  board ovB={0} eff={1} | sidebar ovB={2} eff={3} | remove ovB={4} | lane5 ovB={5} | hud ovB={6} | scroll={7}" -f `
    $v.overflow.board.bottom, $v.overflow.board.effScaleY, `
    $v.overflow.sidebar.bottom, $v.overflow.sidebar.effScaleY, `
    $v.overflow.remove.bottom, $v.overflow.lane5.bottom, $v.overflow.hud.bottom, ($v.scroll | ConvertTo-Json -Compress))
}

$cdp.Dispose()
