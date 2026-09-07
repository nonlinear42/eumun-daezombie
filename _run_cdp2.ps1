# Dedicated CDP measure on port 9333 — do not touch user's Chrome
$ErrorActionPreference = "Stop"
$proj = (Resolve-Path ".").Path
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$cdpPort = 9333
$userData = Join-Path $env:TEMP "eumun-cdp-measure-9333"
New-Item -ItemType Directory -Force -Path $userData | Out-Null
$indexUrl = (New-Object Uri ((Join-Path $proj "index.html"))).AbsoluteUri

# Start headless chrome if not already
$alive = $false
try {
  $null = Invoke-RestMethod "http://127.0.0.1:$cdpPort/json/version" -TimeoutSec 2
  $alive = $true
} catch {}

if (-not $alive) {
  Start-Process -FilePath $chrome -ArgumentList @(
    "--headless=new",
    "--disable-gpu",
    "--remote-debugging-port=$cdpPort",
    "--user-data-dir=$userData",
    "--window-size=1920,1080",
    $indexUrl
  ) | Out-Null
  Start-Sleep -Seconds 2
}

$tabs = Invoke-RestMethod "http://127.0.0.1:$cdpPort/json/list" -TimeoutSec 5
$page = $tabs | Where-Object { $_.type -eq "page" -and $_.url -match "index\.html" } | Select-Object -First 1
if (-not $page) {
  # navigate blank page
  $blank = $tabs | Where-Object { $_.type -eq "page" } | Select-Object -First 1
  $wsUrl = [string]$blank.webSocketDebuggerUrl
} else {
  $wsUrl = [string]$page.webSocketDebuggerUrl
}
Write-Output "wsUrl=$wsUrl"
Write-Output "pageUrl=$($page.url)"

Add-Type @"
using System;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.IO;
public static class CdpHelper {
  public static string Call(string wsUrl, string sendJson, int wantId, int timeoutMs) {
    using (var ws = new ClientWebSocket()) {
      ws.ConnectAsync(new Uri(wsUrl), CancellationToken.None).GetAwaiter().GetResult();
      var bytes = Encoding.UTF8.GetBytes(sendJson);
      ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None).GetAwaiter().GetResult();
      var deadline = DateTime.UtcNow.AddMilliseconds(timeoutMs);
      while (DateTime.UtcNow < deadline) {
        var ms = new MemoryStream();
        var buf = new byte[1024*1024];
        WebSocketReceiveResult result;
        do {
          var remain = (int)(deadline - DateTime.UtcNow).TotalMilliseconds;
          if (remain <= 0) throw new TimeoutException("timeout");
          using (var cts = new CancellationTokenSource(remain)) {
            result = ws.ReceiveAsync(new ArraySegment<byte>(buf), cts.Token).GetAwaiter().GetResult();
          }
          ms.Write(buf, 0, result.Count);
        } while (!result.EndOfMessage);
        var text = Encoding.UTF8.GetString(ms.ToArray());
        if (text.Contains("\"id\":" + wantId) || text.Contains("\"id\": " + wantId)) return text;
      }
      throw new TimeoutException("no matching id");
    }
  }
}
"@

function Cdp([int]$id, [string]$method, $params=$null, [int]$timeoutMs=20000) {
  $map = @{ id = $id; method = $method }
  if ($null -ne $params) { $map.params = $params }
  $ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
  $ser.MaxJsonLength = [int]::MaxValue
  Add-Type -AssemblyName System.Web.Extensions
  $json = $ser.Serialize($map)
  return [CdpHelper]::Call($wsUrl, $json, $id, $timeoutMs)
}

Add-Type -AssemblyName System.Web.Extensions

# Enable + set viewport
[void](Cdp 1 "Runtime.enable" $null 10000)
[void](Cdp 2 "Emulation.setDeviceMetricsOverride" @{
  width = 1920; height = 1080; deviceScaleFactor = 1; mobile = $false
} 10000)

# Navigate (fresh)
$nav = Cdp 3 "Page.navigate" @{ url = $indexUrl } 15000
Write-Output "nav ok"

Start-Sleep -Seconds 2

$expr = Get-Content -LiteralPath (Join-Path $proj "_measure_expr.js") -Raw -Encoding UTF8
# also force battle layout bootstrap
$boot = @'
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  for (const el of document.querySelectorAll("button,.btn,[role=button],a,.start-buttons button")) {
    const t = (el.textContent||"").trim();
    if (/시작|START|플레이|튜토리얼|게임/.test(t)) { try{el.click()}catch(e){} }
  }
  await sleep(300);
  if (typeof setupBattleSideLayout === "function") { try{setupBattleSideLayout()}catch(e){} }
  if (typeof updateGameFitScale === "function") updateGameFitScale();
  return {
    sidebar: !!document.querySelector(".battle-sidebar-left"),
    board: !!document.querySelector(".game-board-viewport"),
    remove: !!document.getElementById("remove-button"),
    overlayHidden: !!(document.getElementById("start-overlay") && getComputedStyle(document.getElementById("start-overlay")).display==="none")
  };
})()
'@

$ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$ser.MaxJsonLength = [int]::MaxValue
$bootJson = $ser.Serialize(@{
  id = 4
  method = "Runtime.evaluate"
  params = @{ expression = $boot; awaitPromise = $true; returnByValue = $true }
})
$bootRes = [CdpHelper]::Call($wsUrl, $bootJson, 4, 30000)
Write-Output ("boot=" + $bootRes.Substring(0, [Math]::Min(400, $bootRes.Length)))

$measJson = $ser.Serialize(@{
  id = 5
  method = "Runtime.evaluate"
  params = @{ expression = $expr; awaitPromise = $true; returnByValue = $true }
})
$measRes = [CdpHelper]::Call($wsUrl, $measJson, 5, 60000)
$out = Join-Path $proj "_measure_out.json"
Set-Content -LiteralPath $out -Value $measRes -Encoding UTF8
Write-Output ("wrote " + $out + " len=" + $measRes.Length)
Write-Output $measRes.Substring(0, [Math]::Min(2500, $measRes.Length))
