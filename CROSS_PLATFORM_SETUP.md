# Cross-Platform Panel Segmentation Setup

This guide explains how to set up the manga panel segmentation feature on both Windows and macOS/Linux systems.

## Overview

The panel segmentation service has been updated to automatically detect your operating system and use the appropriate Python execution method:

- **Windows**: Uses `conda` from PATH or falls back to regular `python`
- **macOS/Linux**: Uses conda with specified environment paths

## Setup Instructions

### Windows

#### Option 1: Using PowerShell (Recommended)
```powershell
.\setup_panel_segmentation.ps1
```

#### Option 2: Using Command Prompt
```cmd
setup_panel_segmentation.bat
```

#### Option 3: Manual Installation
```cmd
pip install -r requirements.txt
```

### macOS/Linux

#### Using the existing shell script:
```bash
./setup_panel_segmentation.sh
```

#### Manual installation:
```bash
pip3 install -r requirements.txt
```

## Dependencies

The following Python packages are required:
- numpy>=1.22.4
- opencv-python-headless>=4.7.0.72
- Pillow>=9.4.0
- scikit-image>=0.19.3
- scipy>=1.10.1

## Troubleshooting

### Windows Issues

1. **Python not found**: Make sure Python is installed and added to your PATH
2. **Conda not found**: The service will automatically fall back to regular Python if conda is not available
3. **Permission errors**: Run the setup script as administrator if needed

### macOS/Linux Issues

1. **Conda path issues**: Update the conda paths in `panel-segmentation-service.ts` if your conda is installed in a different location
2. **Permission errors**: Use `sudo` if needed for system-wide installations

## How It Works

The updated `PanelSegmentationService` class:

1. **Detects the operating system** using Node.js `os.platform()`
2. **Sets appropriate paths** for Python executables and conda environments
3. **Uses fallback strategies** on Windows (conda → python)
4. **Maintains compatibility** with existing macOS/Linux setups

## Testing

After installation, you can test the setup by:

1. Starting your Next.js development server
2. Uploading a manga image
3. Checking the console for successful panel segmentation logs

## Environment Variables (Optional)

You can override the default Python paths by setting environment variables:

```bash
# Windows
set PYTHON_PATH=C:\path\to\python.exe
set CONDA_PATH=C:\path\to\conda.exe

# macOS/Linux
export PYTHON_PATH=/usr/bin/python3
export CONDA_PATH=/opt/conda/bin/conda
```

## Support

If you encounter issues:

1. Check that all dependencies are installed correctly
2. Verify Python is accessible from the command line
3. Check the console logs for detailed error messages
4. Try the manual installation method if automated setup fails