$ErrorActionPreference = "Stop"
$wsUrl = $args[0]
$exprPath = $args[1]
$outPath = $args[2]

$expr = Get-Content -LiteralPath $exprPath -Raw -Encoding UTF8

Add-Type -AssemblyName System.Net.Http
$ws = New-Object System.Net.WebSockets.ClientWebSocket
$ct = [Threading.CancellationToken]::None
$ws.ConnectAsync([Uri]$wsUrl, $ct).GetAwaiter().GetResult()

function Send-Msg([hashtable]$obj) {
  $json = ($obj | ConvertTo-Json -Compress -Depth 30)
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
  $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).GetAwaiter().GetResult()
}

function Recv-Msg() {
  $ms = New-Object System.IO.MemoryStream
  $buffer = New-Object byte[] 65536
  do {
    $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buffer)
    $result = $ws.ReceiveAsync($seg, $ct).GetAwaiter().GetResult()
    $ms.Write($buffer, 0, $result.Count)
  } while (-not $result.EndOfMessage)
  return [Text.Encoding]::UTF8.GetString($ms.ToArray())
}

# Enable runtime
Send-Msg @{ id = 1; method = "Runtime.enable" }
[void](Recv-Msg)
Send-Msg @{ id = 2; method = "Page.enable" }
[void](Recv-Msg)

# Wait a bit for game bootstrap via evaluate polling
$payload = @{
  id = 3
  method = "Runtime.evaluate"
  params = @{
    expression = $expr
    returnByValue = $true
    awaitPromise = $true
  }
}
Send-Msg $payload

# Read until id=3
$report = $null
for ($i = 0; $i -lt 20; $i++) {
  $msg = Recv-Msg
  $obj = $msg | ConvertFrom-Json
  if ($obj.id -eq 3) { $report = $obj; break }
}

$report | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $outPath -Encoding UTF8
Write-Output "wrote $outPath"
$ws.Dispose()
