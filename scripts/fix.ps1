$windows1252 = [System.Text.Encoding]::GetEncoding("windows-1252")
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

Get-ChildItem -Filter *.html | ForEach-Object {
    $text = [IO.File]::ReadAllText($_.FullName, $utf8NoBom)
    
    if ($text -match 'Ã') {
        $bytes = $windows1252.GetBytes($text)
        $fixedText = $utf8NoBom.GetString($bytes)
        
        [IO.File]::WriteAllText($_.FullName, $fixedText, $utf8NoBom)
        Write-Host "Fixed $($_.Name)"
    }
}
