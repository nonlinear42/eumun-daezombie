$ErrorActionPreference = "Stop"
$proj = (Resolve-Path ".").Path
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$cdpPort = 9337
$userData = Join-Path $env:TEMP "eumun-cdp-9337"
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
public class CdpV2 : IDisposable {
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
        if (remain <= 0) throw new TimeoutException("timeout id="+wantId);
        using (var cts = new CancellationTokenSource(Math.Max(1, remain))) {
          result = ws.ReceiveAsync(new ArraySegment<byte>(buf), cts.Token).GetAwaiter().GetResult();
        }
        ms.Write(buf, 0, result.Count);
      } while (!result.EndOfMessage);
      var text = Encoding.UTF8.GetString(ms.ToArray());
      if (text.IndexOf("\"id\":" + wantId) >= 0) return text;
    }
    throw new TimeoutException("no id "+wantId);
  }
  public void Dispose() { try { ws.Dispose(); } catch {} }
}
"@

Start-Process -FilePath $chrome -ArgumentList @(
  "--headless=new","--disable-gpu","--remote-debugging-port=$cdpPort",
  "--user-data-dir=$userData","--window-size=1920,1080","about:blank"
) | Out-Null
Start-Sleep -Seconds 2

$raw = (Invoke-WebRequest "http://127.0.0.1:$cdpPort/json/list" -UseBasicParsing).Content
$tabs = $raw | ConvertFrom-Json
$wsUrl = $null
foreach ($t in $tabs) { if ($t.type -eq "page") { $wsUrl = [string]$t.webSocketDebuggerUrl; break } }
Write-Output "ws=$wsUrl"

$cdp = New-Object CdpV2
$cdp.Connect($wsUrl)
[void]$cdp.Call('{"id":1,"method":"Runtime.enable"}',1,8000)
[void]$cdp.Call('{"id":2,"method":"Page.enable"}',2,8000)

$expr = @'
(async () => {
  for (let i = 0; i < 100; i++) {
    if (typeof updateGameFitScale === "function" && typeof setupBattleSideLayout === "function") break;
    await new Promise(r => setTimeout(r, 50));
  }
  const overlay = document.getElementById("start-overlay");
  if (overlay) { overlay.style.display = "none"; overlay.classList.add("hidden"); }
  try { setupBattleSideLayout(); } catch (e) {}
  updateGameFitScale();
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  updateGameFitScale();
  await new Promise(r => setTimeout(r, 100));

  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const root = document.getElementById("game-scale-root");
  const layout = document.querySelector(".battle-layout");
  const board = document.querySelector(".game-board-viewport");
  const sidebar = document.querySelector(".battle-sidebar-left");
  const remove = document.getElementById("remove-button");
  const hud = document.querySelector(".status-bar");
  const lane5 = document.querySelector('.playfield-start-marker[data-row="4"]');
  const tr = root ? getComputedStyle(root).transform : "none";
  const scale = parseFloat((/matrix\(([^,]+)/.exec(tr) || [])[1] || "1");
  function ov(el) {
    if (!el) return { missing: true };
    const r = el.getBoundingClientRect();
    return {
      bottom: Math.max(0, +(r.bottom - vh).toFixed(2)),
      right: Math.max(0, +(r.right - vw).toFixed(2)),
      top: Math.max(0, +(0 - r.y).toFixed(2)),
      left: Math.max(0, +(0 - r.x).toFixed(2)),
      eff: el.offsetHeight ? +(r.height / el.offsetHeight).toFixed(5) : null
    };
  }
  const oRoot = ov(root), oBoard = ov(board), oSide = ov(sidebar), oRem = ov(remove), oHud = ov(hud), oL5 = ov(lane5);
  const scrollX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    || document.body.scrollWidth > document.body.clientWidth + 1;
  const scrollY = document.documentElement.scrollHeight > document.documentElement.clientHeight + 1
    || document.body.scrollHeight > document.body.clientHeight + 1;
  const zero = (o) => !o.missing && o.bottom === 0 && o.right === 0 && o.top === 0 && o.left === 0;
  return {
    viewport: { w: vw, h: vh },
    rootScale: +scale.toFixed(6),
    expectedScale: +Math.min(vw / 1672, vh / 941).toFixed(6),
    layoutZoom: layout ? String(getComputedStyle(layout).zoom) : null,
    media1900: matchMedia("(min-width: 1900px)").matches,
    hasBoard: !!board,
    hasSidebar: !!sidebar,
    hasRemove: !!remove,
    overflow: { root: oRoot, board: oBoard, sidebar: oSide, remove: oRem, hud: oHud, lane5: oL5 },
    scroll: { x: scrollX, y: scrollY },
    ok: zero(oRoot) && zero(oBoard) && zero(oSide) && zero(oRem) && zero(oHud) && (oL5.missing || zero(oL5))
      && !scrollX && !scrollY
      && Math.abs(scale - Math.min(vw / 1672, vh / 941)) < 0.002
      && Math.abs((oBoard.eff || 0) - scale) < 0.01
      && layout && String(getComputedStyle(layout).zoom) === "1"
  };
})()
'@

$id = 10
foreach ($sz in @(@{w=1366;h=768}, @{w=1536;h=864}, @{w=1920;h=1080})) {
  $id++
  [void]$cdp.Call(('{"id":'+$id+',"method":"Emulation.setDeviceMetricsOverride","params":{"width":'+$sz.w+',"height":'+$sz.h+',"deviceScaleFactor":1,"mobile":false}}'), $id, 8000)
  $id++
  [void]$cdp.Call(('{"id":'+$id+',"method":"Page.navigate","params":{"url":"'+(Escape-JsonString $indexUrl)+'"}}'), $id, 15000)
  Start-Sleep -Seconds 3
  $id++
  $res = $cdp.Call(('{"id":'+$id+',"method":"Runtime.evaluate","params":{"expression":"'+(Escape-JsonString $expr)+'","awaitPromise":true,"returnByValue":true}}'), $id, 45000)
  $j = $res | ConvertFrom-Json
  if ($j.result.exceptionDetails) {
    Write-Output ("==== {0}x{1} EXCEPTION {2}" -f $sz.w,$sz.h,($j.result.exceptionDetails | ConvertTo-Json -Compress -Depth 4))
    continue
  }
  if ($j.error) {
    Write-Output ("==== {0}x{1} ERROR {2}" -f $sz.w,$sz.h,($j.error | ConvertTo-Json -Compress))
    continue
  }
  $v = $j.result.result.value
  Write-Output ("==== {0}x{1} ok={2}" -f $sz.w,$sz.h,$v.ok)
  Write-Output ("  scale={0} expected={1} layoutZoom={2} media1900={3} board={4} side={5} rem={6}" -f `
    $v.rootScale,$v.expectedScale,$v.layoutZoom,$v.media1900,$v.hasBoard,$v.hasSidebar,$v.hasRemove)
  Write-Output ("  ovB board={0}(eff={1}) side={2}(eff={3}) rem={4} lane5={5} hud={6} scroll={7}" -f `
    $v.overflow.board.bottom, $v.overflow.board.eff, `
    $v.overflow.sidebar.bottom, $v.overflow.sidebar.eff, `
    $v.overflow.remove.bottom, $v.overflow.lane5.bottom, $v.overflow.hud.bottom, ($v.scroll|ConvertTo-Json -Compress))
}

$cdp.Dispose()
