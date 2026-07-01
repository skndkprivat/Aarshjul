@echo off
REM ============================================================
REM  Publicer aendringer til GitHub (Aarshjul)
REM  Dobbeltklik denne fil efter du har gemt nye/aendrede filer
REM  i denne mappe via "Gem som"-dialogen i appen.
REM ============================================================

cd /d "%~dp0"

echo.
echo === Tjekker for aendringer ===
git status --short

echo.
set /p CONFIRM="Vil du committe og publicere disse aendringer til GitHub? (j/n): "
if /i not "%CONFIRM%"=="j" (
    echo Afbrudt - intet blev publiceret.
    pause
    exit /b
)

git add .
git commit -m "Opdatering %date% %time%"
git push

echo.
echo === Faerdig! Siden opdaterer typisk indenfor 30-60 sekunder. ===
pause
