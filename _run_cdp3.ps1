$ErrorActionPreference = "Stop"
$proj = (Resolve-Path ".").Path
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$cdpPort = 9333
$userData = Join-Path $env:TEMP "eumun-cdp-measure-9333"
New-Item -ItemType Directory -Force -Path $userData | Out-Null
$indexUrl = ([Uri](Join-Path $proj "index.html")).AbsoluteUri

function Escape-JsonString([string]$s) {
  $sb = New-Object System.Text.StringBuilder
  foreach ($ch in $s.ToCharArray()) {
    $code = [int]$ch
    switch ($ch) {
      '"' { [void]$sb.Append('\"') }
      '\' { [void]$sb.Append('\\') }
      "`n" { [void]$sb.Append('\n') }
      "`r" { [void]$sb.Append('\r') }
      "`t" { [void]$sb.Append('\t') }
      default {
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
public static class CdpHelper2 {
  static ClientWebSocket ws;
  public static void Connect(string wsUrl) {
    ws = new ClientWebSocket();
    ws.ConnectAsync(new Uri(wsUrl), CancellationToken.None).GetAwaiter().GetResult();
  }
  public static string Call(string sendJson, int wantId, int timeoutMs) {
    var bytes = Encoding.UTF8.GetBytes(sendJson);
    ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None).GetAwaiter().GetResult();
    var deadline = DateTime.UtcNow.AddMilliseconds(timeoutMs);
    while (DateTime.UtcNow < deadline) {
      var ms = new MemoryStream();
      var buf = new byte[2*1024*1024];
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
      if (text.IndexOf("\"id\":" + wantId) >= 0 || text.IndexOf("\"id\": " + wantId) >= 0) return text;
    }
    throw new TimeoutException("no matching id");
  }
  public static void Close() { if (ws != null) ws.Dispose(); }
}
"@

$alive = $false
try { $null = Invoke-RestMethod "http://127.0.0.1:$cdpPort/json/version" -TimeoutSec 2; $alive = $true } catch {}
if (-not $alive) {
  Start-Process -FilePath $chrome -ArgumentList @(
    "--headless=new","--disable-gpu","--remote-debugging-port=$cdpPort",
    "--user-data-dir=$userData","--window-size=1920,1080",$indexUrl
  ) | Out-Null
  Start-Sleep -Seconds 2
}

$tabs = Invoke-RestMethod "http://127.0.0.1:$cdpPort/json/list" -TimeoutSec 5
$page = @($tabs | Where-Object { $_.type -eq "page" -and $_.url -match "index\.html" })[0]
if (-not $page) { $page = @($tabs | Where-Object { $_.type -eq "page" })[0] }
$wsUrl = [string]$page.webSocketDebuggerUrl
Write-Output "ws=$wsUrl"

[CdpHelper2]::Connect($wsUrl)
[void]([CdpHelper2]::Call('{"id":1,"method":"Runtime.enable"}', 1, 10000))
[void]([CdpHelper2]::Call('{"id":2,"method":"Emulation.setDeviceMetricsOverride","params":{"width":1920,"height":1080,"deviceScaleFactor":1,"mobile":false}}', 2, 10000))
[void]([CdpHelper2]::Call(('{"id":3,"method":"Page.navigate","params":{"url":"' + (Escape-JsonString $indexUrl) + '"}}'), 3, 15000))
Start-Sleep -Seconds 2

$boot = Get-Content -LiteralPath (Join-Path $proj "_boot_expr.js") -Raw -Encoding UTF8
$meas = Get-Content -LiteralPath (Join-Path $proj "_measure_expr.js") -Raw -Encoding UTF8

$bootMsg = '{"id":4,"method":"Runtime.evaluate","params":{"expression":"' + (Escape-JsonString $boot) + '","awaitPromise":true,"returnByValue":true}}'
$bootRes = [CdpHelper2]::Call($bootMsg, 4, 30000)
Set-Content -LiteralPath (Join-Path $proj "_boot_out.json") -Value $bootRes -Encoding UTF8
Write-Output ("boot head=" + $bootRes.Substring(0, [Math]::Min(500, $bootRes.Length)))

$measMsg = '{"id":5,"method":"Runtime.evaluate","params":{"expression":"' + (Escape-JsonString $meas) + '","awaitPromise":true,"returnByValue":true}}'
$measRes = [CdpHelper2]::Call($measMsg, 5, 60000)
Set-Content -LiteralPath (Join-Path $proj "_measure_out.json") -Value $measRes -Encoding UTF8
Write-Output ("meas len=" + $measRes.Length)
Write-Output $measRes.Substring(0, [Math]::Min(3000, $measRes.Length))
[CdpHelper2]::Close()
