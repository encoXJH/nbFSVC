@echo off
setlocal
cd /d "%~dp0"
title Campus Model Launcher

where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python was not found. Install Python and add it to PATH.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo First run: installing project dependencies...
    where npm >nul 2>nul
    if errorlevel 1 (
        echo [ERROR] npm was not found. Install Node.js and add it to PATH.
        pause
        exit /b 1
    )
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install project dependencies.
        pause
        exit /b 1
    )
)

echo Starting the campus model server...
start "Campus Model Server" /min python -m http.server 8000
ping 127.0.0.1 -n 3 >nul
start "" "http://127.0.0.1:8000/"

echo.
echo The campus model is open in your browser.
echo URL: http://127.0.0.1:8000/
echo Close the Campus Model Server window to stop the server.
echo.
pause
