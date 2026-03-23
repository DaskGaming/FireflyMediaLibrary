@echo off
REM build.bat — Build Firefly Media Library on Windows
REM Produces: dist\Firefly-Media-Library-win.exe (portable, no install needed)
REM           dist\Firefly-Media-Library-linux-x64.zip (copy to Steam Deck)

echo.
echo ╔══════════════════════════════════════════════╗
echo ║     Firefly Media Library — Build Script    ║
echo ╚══════════════════════════════════════════════╝
echo.

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found.
    echo Download from https://nodejs.org  ^(LTS version^)
    echo Make sure to check "Add to PATH" during install.
    pause
    exit /b 1
)
echo Found Node: 
node --version

REM Install dependencies
echo.
echo Installing dependencies...
call npm install
if errorlevel 1 ( echo npm install failed. & pause & exit /b 1 )

REM Build Windows portable exe
echo.
echo Building Windows portable...
call npm run build-win
if errorlevel 1 ( echo Windows build failed. & pause & exit /b 1 )

REM Build Linux zip (for Steam Deck)
echo.
echo Building Linux zip for Steam Deck...
call npm run build-linux
if errorlevel 1 ( echo Linux build failed. & pause & exit /b 1 )

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║  Build output in: dist\                                      ║
echo ║                                                              ║
echo ║  Windows:    dist\Firefly Media Library-win.exe             ║
echo ║  Steam Deck: dist\Firefly Media Library-linux-x64.zip       ║
echo ║                                                              ║
echo ║  To install on Steam Deck:                                   ║
echo ║    Copy the zip + install.sh to your Deck                    ║
echo ║    Run: bash install.sh                                      ║
echo ╚══════════════════════════════════════════════════════════════╝
pause
