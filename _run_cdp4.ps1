$ErrorActionPreference = "Stop"
$proj = (Resolve-Path ".").Path
$indexUrl = ([Uri](Join-Path $proj "index.html")).AbsoluteUri
$cdpPort = 9333

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
        if ($code -lt 0x20) { [void]$sb.AppendFormat('\u{0:x4}', $code) }
        else { [void]$sb.Append($ch) }
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
public class CdpClient3 : IDisposable {
  ClientWebSocket ws = new ClientWebSocket();
  public void Connect(string url) {
    ws.ConnectAsync(new Uri(url), CancellationToken.None).GetAwaiter().GetResult();
  }
  public string Call(string sendJson, int wantId, int timeoutMs) {
    var bytes = Encoding.UTF8.GetBytes(sendJson);
    ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None).GetAwaiter().GetResult();
    var deadline = DateTime.UtcNow.AddMilliseconds(timeoutMs);
    while (DateTime.UtcNow < deadline) {
      var ms = new MemoryStream();
      var buf = new byte[4*1024*1024];
      WebSocketReceiveResult result;
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
    throw new TimeoutException("no matching id");
  }
  public void Dispose() { try { ws.Dispose(); } catch {} }
}
"@

$tabs = @(Invoke-RestMethod "http://127.0.0.1:$cdpPort/json/list" -TimeoutSec 5)
$page = $null
foreach ($t in $tabs) {
  if ($t.type -eq "page" -and $t.url -like "*index.html*") { $page = $t; break }
}
if (-not $page) {
  foreach ($t in $tabs) { if ($t.type -eq "page") { $page = $t; break } }
}
$wsUrl = [string]$page.webSocketDebuggerUrl
Write-Output "page=$($page.url)"
Write-Output "ws=$wsUrl"

$cdp = New-Object CdpClient3
$cdp.Connect($wsUrl)
[void]$cdp.Call('{"id":1,"method":"Runtime.enable"}', 1, 8000)
[void]$cdp.Call('{"id":2,"method":"Emulation.setDeviceMetricsOverride","params":{"width":1920,"height":1080,"deviceScaleFactor":1,"mobile":false}}', 2, 8000)
[void]$cdp.Call(('{"id":3,"method":"Page.navigate","params":{"url":"' + (Escape-JsonString $indexUrl) + '"}}'), 3, 15000)
Start-Sleep -Seconds 2.5

$boot = Get-Content -LiteralPath (Join-Path $proj "_boot_expr.js") -Raw -Encoding UTF8
$bootRes = $cdp.Call(('{"id":4,"method":"Runtime.evaluate","params":{"expression":"' + (Escape-JsonString $boot) + '","awaitPromise":true,"returnByValue":true}}'), 4, 30000)
Set-Content (Join-Path $proj "_boot_out.json") $bootRes -Encoding UTF8
Write-Output ("boot=" + $bootRes.Substring(0, [Math]::Min(450, $bootRes.Length)))

$expr = Get-Content -LiteralPath (Join-Path $proj "_measure_expr2.js") -Raw -Encoding UTF8
$meas = $cdp.Call(('{"id":5,"method":"Runtime.evaluate","params":{"expression":"' + (Escape-JsonString $expr) + '","returnByValue":true}}'), 5, 60000)
Set-Content (Join-Path $proj "_measure2_out.json") $meas -Encoding UTF8
$j = $meas | ConvertFrom-Json
if ($j.result.exceptionDetails) {
  Write-Output ("EXC=" + ($j.result.exceptionDetails | ConvertTo-Json -Depth 5 -Compress))
} else {
  $v = $j.result.result.value
  $v | ConvertTo-Json -Depth 16 | Set-Content (Join-Path $proj "_measure2_pretty.json") -Encoding UTF8
  Write-Output "scale=$($v.scale) expected=$($v.expectedScale) htmlZoom=$($v.htmlZoom) bodyZoom=$($v.bodyZoom)"
  Write-Output ("root " + ($v.root | ConvertTo-Json -Compress))
  Write-Output ("board offset=$($v.board.offsetW)x$($v.board.offsetH) cssTop=$($v.board.cssTop) rect=" + ($v.board.rect | ConvertTo-Json -Compress))
  Write-Output ("board designFromRect=" + ($v.board.designFromRect | ConvertTo-Json -Compress))
  Write-Output ("board ovVP=" + ($v.board.overflowViewportPx | ConvertTo-Json -Compress) + " ovRoot=" + ($v.board.overflowRootVisualPx | ConvertTo-Json -Compress))
  Write-Output ("sidebar offset=$($v.sidebar.offsetW)x$($v.sidebar.offsetH) rect=" + ($v.sidebar.rect | ConvertTo-Json -Compress))
  Write-Output ("sidebar design=" + ($v.sidebar.designFromRect | ConvertTo-Json -Compress) + " ovVP=" + ($v.sidebar.overflowViewportPx | ConvertTo-Json -Compress))
  Write-Output ("remove offset=$($v.remove.offsetW)x$($v.remove.offsetH) rect=" + ($v.remove.rect | ConvertTo-Json -Compress))
  Write-Output ("remove design=" + ($v.remove.designFromRect | ConvertTo-Json -Compress) + " ovVP=" + ($v.remove.overflowViewportPx | ConvertTo-Json -Compress))
  Write-Output ("hud rect=" + ($v.hud.rect | ConvertTo-Json -Compress) + " ovVP=" + ($v.hud.overflowViewportPx | ConvertTo-Json -Compress))
  Write-Output "SPILL:"
  @($v.spillTop30) | ForEach-Object { Write-Output ("  pastB=$($_.pastBottom) pastR=$($_.pastRight) $($_.id) $($_.cls)") }
  Write-Output "BOARD ANCESTORS:"
  @($v.board.ancestors) | ForEach-Object {
    Write-Output ("  #$($_.id) .$($_.cls) pos=$($_.pos) tr=$($_.transform) zoom=$($_.zoom) filter=$($_.filter) y=$($_.rect.y) hRect=$($_.rect.h) offH=$($_.offsetH)")
  }
}
$cdp.Dispose()
