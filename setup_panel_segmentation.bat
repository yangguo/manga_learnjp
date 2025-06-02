@echo off
REM Installation script for Panel Segmentation Dependencies on Windows

echo Setting up manga panel segmentation...

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Python is not installed or not in PATH. Please install Python first.
    pause
    exit /b 1
)

REM Check if pip is installed
pip --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: pip is not installed. Please install pip first.
    pause
    exit /b 1
)

REM Install Python dependencies
echo Installing Python dependencies...
pip install -r requirements.txt

if %errorlevel% neq 0 (
    echo Error: Failed to install dependencies.
    pause
    exit /b 1
)

REM Verify installation
echo Verifying installation...
python -c "try: import numpy, cv2, PIL, skimage; print('✅ All dependencies installed successfully!'); except ImportError as e: print(f'❌ Installation failed: {e}'); exit(1)"

if %errorlevel% neq 0 (
    echo Installation verification failed.
    pause
    exit /b 1
)

echo 🎉 Panel segmentation setup complete!
echo You can now use the manga panel segmentation feature.
pause