Add-Type -AssemblyName System.Drawing

$filesToCrop = @("assets\img\comunidad.jpg", "assets\img\paloma.jpg", "assets\img\peniel-bg.jpg")
$cropAmount = 15

foreach ($file in $filesToCrop) {
    if (Test-Path $file) {
        try {
            $bmp = [System.Drawing.Bitmap]::FromFile($file)
            
            $rect = New-Object System.Drawing.Rectangle($cropAmount, $cropAmount, ($bmp.Width - ($cropAmount * 2)), ($bmp.Height - ($cropAmount * 2)))
            $croppedBmp = $bmp.Clone($rect, $bmp.PixelFormat)
            
            $bmp.Dispose()
            
            $croppedBmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Jpeg)
            $croppedBmp.Dispose()
            
            Write-Host "Successfully cropped $($file)"
        } catch {
            Write-Host "Error cropping $($file) - $_"
        }
    }
}
