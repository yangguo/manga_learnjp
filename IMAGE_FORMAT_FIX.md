# Image Format Compatibility Fix

## Issue
PNG files were working in panel analysis mode but failing in simple analysis mode with the error:
```
OpenAI-format API error: 400 - {"error":{"code":"InvalidParameter.UnsupportedImageFormat","message":"The request failed because the image format is not supported by the API. Request id: ...","param":"image_url","type":"BadRequest"}}
```

## Root Cause
The AI service methods were hardcoding image formats as `image/jpeg` in the data URLs sent to APIs, regardless of the actual image format. This caused issues when:

1. A PNG file was uploaded
2. Simple analysis mode attempted to use `analyzeImage()` instead of `analyzeMangaImage()`
3. The API received `data:image/jpeg;base64,...` for what was actually PNG data
4. The API rejected the request due to format mismatch

## Solution
Created image utility functions to:

1. **Detect image format** from base64 data by examining file headers/magic numbers
2. **Generate correct MIME types** for different image formats
3. **Create proper data URLs** with the correct format

### Files Modified

- `src/lib/image-utils.ts` - New utility functions for image format detection
- `src/lib/ai-service.ts` - Updated all service methods to use correct image formats
- `src/lib/improved-text-detection.ts` - Fixed hardcoded JPEG format

### Functions Added

- `detectImageFormat(base64Data)` - Detects PNG, JPEG, WebP, GIF formats
- `getImageMimeType(base64Data)` - Returns correct MIME type
- `createImageDataURL(base64Data)` - Creates proper data URL with detected format

## Supported Formats
- PNG (most common for manga/screenshots)
- JPEG/JPG 
- WebP
- GIF
- Fallback to JPEG for unknown formats

## Testing
The fix ensures that both panel analysis mode and simple analysis mode work correctly with PNG files and other image formats.
