Add-Type -AssemblyName System.Drawing

$imgDir = "assets\img"
$files = Get-ChildItem -Path $imgDir -Filter *.jpg

foreach ($file in $files) {
    try {
        $bmp = [System.Drawing.Bitmap]::FromFile($file.FullName)
        
        $hasYellow = $false
        
        # Check all edges (margin of 20 pixels)
        for ($y = 0; $y -lt $bmp.Height; $y += 5) {
            for ($x = 0; $x -lt $bmp.Width; $x += 5) {
                # Only check near borders
                if ($x -lt 20 -or $x -gt ($bmp.Width - 20) -or $y -lt 20 -or $y -gt ($bmp.Height - 20)) {
                    $color = $bmp.GetPixel($x, $y)
                    if ($color.R -gt 200 -and $color.G -gt 200 -and $color.B -lt 100) {
                        $hasYellow = $true
                        break
                    }
                }
            }
            if ($hasYellow) { break }
        }
        
        if ($hasYellow) {
            Write-Host "Found yellow border in: $($file.Name)"
        }
        
        $bmp.Dispose()
    } catch {
        Write-Host "Error reading $($file.Name)"
    }
}
