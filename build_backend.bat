@echo off
REM Packages app.py (the Flask/ffmpeg backend) into a standalone folder,
REM with no Python installation required to run it. This is what the
REM Electron build bundles as a sidecar process.
REM Run inside backend\, after `pip install -r requirements.txt`.

pyinstaller --noconfirm --name Clipper-Backend ^
    --collect-all faster_whisper ^
    --collect-all librosa ^
    --add-data "static;static" ^
    --add-data "src;src" ^
    app.py

echo.
echo Done. Backend bundle is at: dist\Clipper-Backend\
echo This gets picked up automatically by the frontend's electron:build step
echo via the "../backend/dist/Clipper-Backend" extraResources entry in package.json.
pause
