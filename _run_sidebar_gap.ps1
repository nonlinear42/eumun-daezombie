$ErrorActionPreference = "Stop"
$proj = (Resolve-Path ".").Path
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$cdpPort = 9341
$userData = Join-Path $env:TEMP "eumun-cdp-9341"
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
public class CdpGap : IDisposable {
  ClientWebSocket ws = new ClientWebSocket();
  public void Connect(string url) { ws.ConnectAsync(new Uri(url), CancellationToken.None).GetAwaiter().GetResult(); }
  public string Call(string sendJson, int wantId, int timeoutMs) {
    var bytes = Encoding.UTF8.GetBytes(sendJson);
    ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None).GetAwaiter().GetResult();
    var deadline = DateTime.UtcNow.AddMilliseconds(timeoutMs);
    while (DateTime.UtcNow < deadline) {
      var ms = new MemoryStream(); var buf = new byte[4*1024*1024]; WebSocketReceiveResult result;
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

Start-Process -FilePath $chrome -ArgumentList @(
  "--headless=new","--disable-gpu","--remote-debugging-port=$cdpPort",
  "--user-data-dir=$userData","--window-size=1366,768","about:blank"
) | Out-Null
Start-Sleep -Seconds 2

$raw = (Invoke-WebRequest "http://127.0.0.1:$cdpPort/json/list" -UseBasicParsing).Content
$tabs = $raw | ConvertFrom-Json
$wsUrl = $null
foreach ($t in $tabs) { if ($t.type -eq "page") { $wsUrl = [string]$t.webSocketDebuggerUrl; break } }

$cdp = New-Object CdpGap
$cdp.Connect($wsUrl)
[void]$cdp.Call('{"id":1,"method":"Runtime.enable"}',1,8000)
[void]$cdp.Call('{"id":2,"method":"Emulation.setDeviceMetricsOverride","params":{"width":1366,"height":768,"deviceScaleFactor":1,"mobile":false}}',2,8000)
[void]$cdp.Call(('{"id":3,"method":"Page.navigate","params":{"url":"'+(Escape-JsonString $indexUrl)+'"}}'),3,15000)
Start-Sleep -Seconds 3

$expr = Get-Content -LiteralPath (Join-Path $proj "_measure_sidebar_gap.js") -Raw -Encoding UTF8
$res = $cdp.Call(('{"id":4,"method":"Runtime.evaluate","params":{"expression":"'+(Escape-JsonString $expr)+'","awaitPromise":true,"returnByValue":true}}'),4,45000)
Set-Content -LiteralPath (Join-Path $proj "_sidebar_gap_out.json") -Value $res -Encoding UTF8
$j = $res | ConvertFrom-Json
if ($j.result.exceptionDetails) {
  Write-Output ("EXC=" + ($j.result.exceptionDetails | ConvertTo-Json -Depth 6 -Compress))
} else {
  $v = $j.result.result.value
  $v | ConvertTo-Json -Depth 12 | Set-Content (Join-Path $proj "_sidebar_gap_pretty.json") -Encoding UTF8
  Write-Output ("viewport={0}x{1} scale={2} cards={3}" -f $v.viewport.w,$v.viewport.h,$v.scale,$v.cardCount)
  Write-Output ("panel rect={0}" -f ($v.panel.rect | ConvertTo-Json -Compress))
  Write-Output ("panel pad L/R={0}/{1} box={2} clientW={3}" -f $v.panel.paddingLeft,$v.panel.paddingRight,$v.panel.boxSizing,$v.panel.clientW)
  Write-Output ("grid rect={0}" -f ($v.grid.rect | ConvertTo-Json -Compress))
  Write-Output ("grid pad L/R={0}/{1} colGap={2} tpl={3} box={4} clientW={5} scrollW={6}" -f $v.grid.paddingLeft,$v.grid.paddingRight,$v.grid.columnGap,$v.grid.gridTemplateColumns,$v.grid.boxSizing,$v.grid.clientW,$v.grid.scrollW)
  Write-Output ("left card w={0} rect={1}" -f $v.leftCard.offsetW,($v.leftCard.rect|ConvertTo-Json -Compress))
  Write-Output ("right card w={0} rect={1}" -f $v.rightCard.offsetW,($v.rightCard.rect|ConvertTo-Json -Compress))
  Write-Output ("GAPS screen={0}" -f ($v.gapsScreen|ConvertTo-Json -Compress))
  Write-Output ("GAPS design={0}" -f ($v.gapsDesign|ConvertTo-Json -Compress))
  Write-Output ("ANALYSIS={0}" -f ($v.analysis|ConvertTo-Json -Compress))
}
$cdp.Dispose()
