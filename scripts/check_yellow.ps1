Add-Type -AssemblyName System.Drawing

$imgDir = "assets\img"
$files = Get-ChildItem -Path $imgDir -Filter *.jpg

foreach ($file in $files) {
    try {
        $bmp = [System.Drawing.Bitmap]::FromFile($file.FullName)
        
        # Check top edge (first 5 rows) for yellow pixels (R > 200, G > 200, B < 100)
        $hasYellow = $false
        for ($y = 0; $y -lt 10; $y++) {
            for ($x = 0; $x -lt $bmp.Width; $x += 10) {
                $color = $bmp.GetPixel($x, $y)
                if ($color.R -gt 200 -and $color.G -gt 200 -and $color.B -lt 100) {
                    $hasYellow = $true
                    break
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
