$root = "C:\Users\clyns\AndroidStudioProjects\SportsPerformance\work\admin-desktop"
$libraryPath = "C:\Users\clyns\AndroidStudioProjects\SportsPerformance\app\src\main\assets\training_library_canonical.json"
$indexPath = Join-Path $root "index.html"
$port = 8765

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Start()

Write-Host "HCI Admin Desktop ativo em http://127.0.0.1:$port"
Start-Process "http://127.0.0.1:$port"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        $path = $request.Url.AbsolutePath

        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
        $response.Headers.Add("Access-Control-Allow-Methods", "GET,POST,OPTIONS")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 204
            $response.Close()
            continue
        }

        if ($path -eq "/api/library" -and $request.HttpMethod -eq "GET") {
            $json = Get-Content $libraryPath -Raw
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.ContentType = "application/json; charset=utf-8"
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        if ($path -eq "/api/library" -and $request.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
            $body = $reader.ReadToEnd()
            $reader.Close()
            [System.IO.File]::WriteAllText($libraryPath, $body, [System.Text.UTF8Encoding]::new($false))
            $buffer = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true}')
            $response.ContentType = "application/json; charset=utf-8"
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        if ($path -eq "/" -or $path -eq "/index.html") {
            $html = Get-Content $indexPath -Raw
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($html)
            $response.ContentType = "text/html; charset=utf-8"
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        $response.StatusCode = 404
        $response.Close()
    }
}
finally {
    $listener.Stop()
}
