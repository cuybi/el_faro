@echo off
title Subir El Faro a GitHub
cd /d "c:\Users\E-Tech Group\.gemini\antigravity-ide\scratch\el-faro"
echo ====================================================
echo  Subiendo El Faro a https://github.com/cuybi/el_faro
echo ====================================================
echo.
git push -u origin main
echo.
if %errorlevel% equ 0 (
    echo [EXITO] Subido con exito a GitHub!
) else (
    echo [ERROR] No se pudo subir. Revisa el mensaje arriba.
)
echo.
pause
