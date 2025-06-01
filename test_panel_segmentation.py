#!/usr/bin/env python3
"""
Test script for panel segmentation
"""

import base64
import json
import sys
import os

# Add src/lib to path to import panel_segmentation
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src', 'lib'))

from panel_segmentation import segment_manga_panels

def test_with_sample_image():
    """Test panel segmentation with a simple test image"""
    try:
        # Create a simple test image (white background with black lines to simulate panels)
        from PIL import Image, ImageDraw
        import io
        
        # Create a 800x600 test image
        img = Image.new('RGB', (800, 600), 'white')
        draw = ImageDraw.Draw(img)
        
        # Draw some panel-like structures
        # Vertical line dividing the image
        draw.line([(400, 0), (400, 600)], fill='black', width=3)
        
        # Horizontal line dividing the left side
        draw.line([(0, 300), (400, 300)], fill='black', width=3)
        
        # Another vertical line on the right side
        draw.line([(600, 0), (600, 600)], fill='black', width=3)
        
        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG')
        image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        print("Testing panel segmentation with synthetic image...")
        result = segment_manga_panels(image_base64)
        
        if result.get('error'):
            print(f"❌ Error: {result['error']}")
            return False
        
        print(f"✅ Segmentation successful!")
        print(f"   Total panels found: {result['totalPanels']}")
        print(f"   Reading order: {result['readingOrder']}")
        print(f"   Original image size: {result['originalImage']['width']}x{result['originalImage']['height']}")
        
        for i, panel in enumerate(result['panels']):
            bbox = panel['boundingBox']
            print(f"   Panel {i+1}: ({bbox['x']}, {bbox['y']}) {bbox['width']}x{bbox['height']}")
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

def main():
    """Main test function"""
    print("🧪 Testing Panel Segmentation")
    print("=" * 40)
    
    # Test dependencies
    try:
        import numpy
        import cv2
        import PIL
        import skimage
        print("✅ All dependencies available")
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        print("Please run: pip3 install -r requirements.txt")
        return 1
    
    # Test with synthetic image
    if not test_with_sample_image():
        return 1
    
    print("\n🎉 All tests passed!")
    print("Panel segmentation is working correctly.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
