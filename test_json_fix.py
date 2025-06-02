#!/usr/bin/env python3
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src', 'lib'))

from panel_segmentation import segment_manga_panels
import base64
import json

def test_json_serialization():
    """Test if the JSON serialization issue is fixed"""
    try:
        # Load sample image
        with open('public/images/sample-manga.png', 'rb') as f:
            img_data = base64.b64encode(f.read()).decode()
        
        # Test segmentation
        result = segment_manga_panels(img_data)
        
        # Test JSON serialization
        json_str = json.dumps(result, indent=2)
        print(f"✅ Success: Found {result['totalPanels']} panels")
        print(f"✅ JSON serialization works correctly")
        print(f"Original image size: {result['originalImage']['width']}x{result['originalImage']['height']}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

if __name__ == "__main__":
    test_json_serialization()