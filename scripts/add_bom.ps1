$utf8WithBom = New-Object System.Text.UTF8Encoding $true
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

Get-ChildItem -Filter *.html | ForEach-Object {
    $text = [IO.File]::ReadAllText($_.FullName, $utf8NoBom)
    [IO.File]::WriteAllText($_.FullName, $text, $utf8WithBom)
    Write-Host "Added BOM to $($_.Name)"
}
