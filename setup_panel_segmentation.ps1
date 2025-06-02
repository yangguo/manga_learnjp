# Installation script for Panel Segmentation Dependencies on Windows (PowerShell)

Write-Host "Setting up manga panel segmentation..." -ForegroundColor Green

# Check if Python is installed
try {
    $pythonVersion = python --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Python not found"
    }
    Write-Host "Found Python: $pythonVersion" -ForegroundColor Yellow
} catch {
    Write-Host "Error: Python is not installed or not in PATH. Please install Python first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if pip is installed
try {
    $pipVersion = pip --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "pip not found"
    }
    Write-Host "Found pip: $pipVersion" -ForegroundColor Yellow
} catch {
    Write-Host "Error: pip is not installed. Please install pip first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Install Python dependencies
Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
try {
    pip install -r requirements.txt
    if ($LASTEXITCODE -ne 0) {
        throw "pip install failed"
    }
} catch {
    Write-Host "Error: Failed to install dependencies." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Verify installation
Write-Host "Verifying installation..." -ForegroundColor Yellow
try {
    $result = python -c "try: import numpy, cv2, PIL, skimage; print('OK'); except ImportError as e: print(f'FAILED: {e}'); exit(1)" 2>&1
    if ($LASTEXITCODE -ne 0 -or $result -notmatch "OK") {
        throw "Verification failed: $result"
    }
    Write-Host "✅ All dependencies installed successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Installation verification failed: $_" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "🎉 Panel segmentation setup complete!" -ForegroundColor Green
Write-Host "You can now use the manga panel segmentation feature." -ForegroundColor Green
Read-Host "Press Enter to exit"