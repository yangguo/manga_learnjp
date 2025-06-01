#!/bin/bash

# Installation script for Panel Segmentation Dependencies

echo "Setting up manga panel segmentation..."

# Check if Python3 is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python3 is not installed. Please install Python3 first."
    exit 1
fi

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo "Error: pip3 is not installed. Please install pip3 first."
    exit 1
fi

# Install Python dependencies
echo "Installing Python dependencies..."
pip3 install -r requirements.txt

# Verify installation
echo "Verifying installation..."
python3 -c "
try:
    import numpy
    import cv2
    import PIL
    import skimage
    print('✅ All dependencies installed successfully!')
except ImportError as e:
    print(f'❌ Installation failed: {e}')
    exit(1)
"

echo "🎉 Panel segmentation setup complete!"
echo "You can now use the manga panel segmentation feature."
