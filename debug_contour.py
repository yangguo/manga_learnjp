#!/usr/bin/env python3
"""
Debug script for contour detection
"""

import sys
import os
from PIL import Image, ImageDraw
import numpy as np
import cv2

# Add src/lib to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src', 'lib'))

from panel_segmentation import remove_black_borders, detect_panels_contour_based

def create_simple_test_image():
    """Create a very simple test image with clear panels"""
    # Create a simple image with clear black borders
    img = Image.new('RGB', (600, 400), 'black')
    draw = ImageDraw.Draw(img)
    
    # White content area
    draw.rectangle([(50, 50), (550, 350)], fill='white')
    
    # Draw clear panel borders
    # Vertical line in middle
    draw.line([(300, 50), (300, 350)], fill='black', width=5)
    
    # Horizontal line in middle
    draw.line([(50, 200), (550, 200)], fill='black', width=5)
    
    return img

def debug_contour_detection():
    """Debug the contour detection step by step"""
    print("🔍 Debugging contour detection...")
    
    # Create test image
    img = create_simple_test_image()
    img_array = np.array(img)
    
    print(f"Original image shape: {img_array.shape}")
    
    # Remove black borders
    cropped, crop_info = remove_black_borders(img_array)
    print(f"Cropped image shape: {cropped.shape}")
    print(f"Crop info: {crop_info}")
    
    # Convert to grayscale
    gray = cv2.cvtColor(cropped, cv2.COLOR_RGB2GRAY)
    print(f"Grayscale shape: {gray.shape}")
    print(f"Grayscale min/max: {gray.min()}/{gray.max()}")
    
    # Try edge detection
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    print(f"Edges detected: {np.sum(edges > 0)} pixels")
    
    # Find contours
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    print(f"Contours found: {len(contours)}")
    
    # Analyze each contour
    min_area = (cropped.shape[0] * cropped.shape[1]) * 0.005
    max_area = (cropped.shape[0] * cropped.shape[1]) * 0.9
    print(f"Area thresholds: {min_area} - {max_area}")
    
    for i, contour in enumerate(contours):
        area = cv2.contourArea(contour)
        x, y, w, h = cv2.boundingRect(contour)
        print(f"Contour {i}: area={area}, bbox=({x},{y},{w},{h})")
        
        if min_area < area < max_area and w > 50 and h > 50:
            aspect_ratio = w / h
            print(f"  -> Valid contour! Aspect ratio: {aspect_ratio}")
    
    # Test the actual function
    panels = detect_panels_contour_based(cropped)
    print(f"\nFunction returned {len(panels)} panels:")
    for i, (x, y, w, h) in enumerate(panels):
        print(f"  Panel {i}: ({x}, {y}) {w}x{h}")

if __name__ == "__main__":
    debug_contour_detection()