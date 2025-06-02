#!/usr/bin/env python3
"""
Test script for improved text detection
This script tests the enhanced text detection capabilities
"""

import base64
import json
import sys
import os
from PIL import Image, ImageDraw, ImageFont
import io

# Add src/lib to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src', 'lib'))

def create_test_manga_panel_with_text():
    """Create a test manga panel with various types of Japanese text"""
    # Create a 400x300 test panel
    img = Image.new('RGB', (400, 300), 'white')
    draw = ImageDraw.Draw(img)
    
    # Try to use a font that supports Japanese characters
    try:
        # Try to load a system font that supports Japanese
        font_large = ImageFont.truetype("msgothic.ttc", 24)  # Windows Japanese font
        font_small = ImageFont.truetype("msgothic.ttc", 16)
    except:
        try:
            font_large = ImageFont.truetype("NotoSansCJK-Regular.ttc", 24)  # Alternative
            font_small = ImageFont.truetype("NotoSansCJK-Regular.ttc", 16)
        except:
            # Fallback to default font
            font_large = ImageFont.load_default()
            font_small = ImageFont.load_default()
    
    # Draw speech bubble
    draw.ellipse([50, 50, 200, 120], fill='white', outline='black', width=2)
    
    # Add Japanese text in speech bubble
    draw.text((70, 70), "こんにちは！", fill='black', font=font_large)
    
    # Add sound effect
    draw.text((250, 30), "ドキドキ", fill='black', font=font_small)
    
    # Add small text/whisper
    draw.text((300, 200), "えー", fill='gray', font=font_small)
    
    # Add thought bubble
    draw.ellipse([100, 180, 250, 250], fill='white', outline='black', width=1)
    draw.text((120, 205), "そうですね", fill='black', font=font_small)
    
    # Add narration box
    draw.rectangle([20, 260, 180, 290], fill='lightgray', outline='black')
    draw.text((25, 265), "次の日...", fill='black', font=font_small)
    
    return img

def create_minimal_text_panel():
    """Create a panel with very small/faint text that might be missed"""
    img = Image.new('RGB', (300, 200), 'white')
    draw = ImageDraw.Draw(img)
    
    try:
        font_tiny = ImageFont.truetype("msgothic.ttc", 12)
    except:
        font_tiny = ImageFont.load_default()
    
    # Very small sound effect
    draw.text((250, 20), "ピッ", fill='lightgray', font=font_tiny)
    
    # Single character exclamation
    draw.text((150, 100), "あ", fill='gray', font=font_tiny)
    
    return img

def test_panel_with_text():
    """Test text detection on a panel with obvious text"""
    print("\n🧪 Testing panel with clear Japanese text...")
    
    # Create test image
    img = create_test_manga_panel_with_text()
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG')
    image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    
    # Save test image for reference
    img.save('test_panel_with_text.jpg')
    print("📁 Test image saved as 'test_panel_with_text.jpg'")
    
    print("Expected text: こんにちは！, ドキドキ, えー, そうですね, 次の日...")
    print("\n💡 To test this with the actual AI service:")
    print("1. Upload the generated test_panel_with_text.jpg to your manga analyzer")
    print("2. Check if all the Japanese text is detected")
    print("3. Look for: dialogue, sound effects, whispers, thoughts, and narration")
    
    return True

def test_minimal_text_panel():
    """Test text detection on a panel with very small text"""
    print("\n🧪 Testing panel with minimal/faint text...")
    
    # Create test image
    img = create_minimal_text_panel()
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG')
    image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    
    # Save test image for reference
    img.save('test_minimal_text.jpg')
    print("📁 Test image saved as 'test_minimal_text.jpg'")
    
    print("Expected text: ピッ, あ (very small/faint)")
    print("\n💡 This tests the AI's ability to detect small or faint text")
    
    return True

def create_no_text_panel():
    """Create a panel with no text to test false positive prevention"""
    print("\n🧪 Testing panel with no text...")
    
    img = Image.new('RGB', (300, 200), 'white')
    draw = ImageDraw.Draw(img)
    
    # Draw some non-text elements
    draw.ellipse([50, 50, 150, 150], fill='lightblue', outline='blue')
    draw.rectangle([200, 100, 280, 180], fill='lightgreen', outline='green')
    
    # Save test image
    img.save('test_no_text.jpg')
    print("📁 Test image saved as 'test_no_text.jpg'")
    print("Expected: No text should be detected")
    
    return True

def main():
    """Main test function"""
    print("🧪 Testing Improved Text Detection")
    print("=" * 50)
    
    print("\n📋 This script creates test images to verify text detection improvements:")
    print("   • Panel with various Japanese text types")
    print("   • Panel with minimal/faint text")
    print("   • Panel with no text (control)")
    
    try:
        # Test with clear text
        test_panel_with_text()
        
        # Test with minimal text
        test_minimal_text_panel()
        
        # Test with no text
        create_no_text_panel()
        
        print("\n✅ Test images created successfully!")
        print("\n🔍 Next steps:")
        print("1. Start your manga analyzer application")
        print("2. Upload each test image (test_panel_with_text.jpg, test_minimal_text.jpg, test_no_text.jpg)")
        print("3. Verify that:")
        print("   • All Japanese text is detected in the first image")
        print("   • Small/faint text is detected in the second image")
        print("   • No false text is detected in the third image")
        print("\n📊 Compare results before and after the text detection improvements!")
        
        return 0
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())