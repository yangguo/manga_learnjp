#!/usr/bin/env python3
import base64
import json
import sys
import os

# Add the lib directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src', 'lib'))

# Import the panel segmentation function
sys.path.append('src/lib')
exec(open('src/lib/panel_segmentation.py').read())

# Load sample image
with open('public/images/sample-manga.png', 'rb') as f:
    image_data = base64.b64encode(f.read()).decode()

print("Testing panel segmentation...")
print(f"Image data length: {len(image_data)}")

result = segment_manga_panels(image_data)
print(f"Panels found: {len(result['panels'])}")
print(f"Has image data: {all('imageData' in panel for panel in result['panels'])}")
print(f"Reading order: {result['readingOrder']}")

if result['panels']:
    print(f"First panel has imageData: {'imageData' in result['panels'][0]}")
    if 'imageData' in result['panels'][0]:
        print(f"First panel imageData length: {len(result['panels'][0]['imageData'])}")
