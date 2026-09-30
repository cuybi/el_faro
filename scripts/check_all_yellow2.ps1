Add-Type -AssemblyName System.Drawing

$imgDir = "assets\img"
$files = Get-ChildItem -Path $imgDir -Filter *.jpg

foreach ($file in $files) {
    try {
        $bmp = [System.Drawing.Bitmap]::FromFile($file.FullName)
        
        $yellowCoords = @()
        
        for ($y = 0; $y -lt $bmp.Height; $y += 10) {
            for ($x = 0; $x -lt $bmp.Width; $x += 10) {
                $color = $bmp.GetPixel($x, $y)
                if ($color.R -gt 200 -and $color.G -gt 200 -and $color.B -lt 100) {
                    $yellowCoords += "$x,$y"
                }
            }
        }
        
        if ($yellowCoords.Count -gt 0) {
            Write-Host "Found yellow in $($file.Name): count $($yellowCoords.Count), first at $($yellowCoords[0])"
        }
        
        $bmp.Dispose()
    } catch {
        Write-Host "Error reading $($file.Name)"
    }
}
