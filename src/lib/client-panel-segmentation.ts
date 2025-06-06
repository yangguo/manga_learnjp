/**
 * Client-Side Panel Segmentation Service
 * Implements comic panel segmentation using OpenCV.js
 * Based on the Python implementation but runs entirely in the browser
 */

import type { PanelSegmentationResult, SegmentedPanel } from './types'

export class ClientPanelSegmentationService {
  private cv: any = null
  private isInitialized = false

  constructor() {
    // Don't initialize OpenCV in constructor to avoid SSR issues
    // It will be initialized lazily when needed
  }

  private async initializeOpenCV(): Promise<void> {
    try {
      // Check if OpenCV.js is already loaded and ready
      if (typeof window !== 'undefined' && (window as any).cv && (window as any).cv.Mat) {
        this.cv = (window as any).cv
        this.isInitialized = true
        console.log('✅ OpenCV.js already loaded and ready')
        return
      }

      console.log('🔄 Loading OpenCV.js...')
      // Load OpenCV.js dynamically
      await this.loadOpenCVScript()
      
      console.log('🔄 Waiting for OpenCV.js to be ready...')
      // Wait for OpenCV to be ready with better error handling
      await new Promise<void>((resolve, reject) => {
        let attempts = 0
        const maxAttempts = 300 // 30 seconds with 100ms intervals
        
        const checkCV = () => {
          attempts++
          
          if (typeof window !== 'undefined' && (window as any).cv) {
            const cv = (window as any).cv
            
            // Check if OpenCV is fully loaded
            if (cv.Mat && cv.imread && cv.imshow && cv.cvtColor) {
              this.cv = cv
              this.isInitialized = true
              console.log('✅ OpenCV.js initialized successfully')
              resolve()
              return
            }
          }
          
          if (attempts >= maxAttempts) {
            reject(new Error(`OpenCV.js failed to initialize within ${maxAttempts * 100}ms. The script may have loaded but OpenCV functions are not available.`))
            return
          }
          
          setTimeout(checkCV, 100)
        }
        
        checkCV()
      })
    } catch (error) {
      console.error('❌ Failed to initialize OpenCV.js:', error)
      this.isInitialized = false
      throw error
    }
  }

  private loadOpenCVScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('OpenCV.js can only be loaded in browser environment'))
        return
      }

      // Check if script is already loaded
      const existingScript = document.querySelector('script[src*="opencv.js"]')
      if (existingScript) {
        console.log('✅ OpenCV.js script already exists in DOM')
        resolve()
        return
      }

      const script = document.createElement('script')
      // Use a more reliable CDN with fallback
      const urls = [
        'https://cdn.jsdelivr.net/npm/opencv.js@1.2.1/opencv.js',
        'https://docs.opencv.org/4.8.0/opencv.js',
        'https://unpkg.com/opencv.js@1.2.1/opencv.js'
      ]
      
      let urlIndex = 0
      
      const tryLoadScript = () => {
        if (urlIndex >= urls.length) {
          reject(new Error('Failed to load OpenCV.js from all available sources'))
          return
        }
        
        script.src = urls[urlIndex]
        console.log(`🔄 Attempting to load OpenCV.js from: ${script.src}`)
        
        script.onload = () => {
          console.log(`✅ Successfully loaded OpenCV.js from: ${script.src}`)
          resolve()
        }
        
        script.onerror = () => {
          console.warn(`❌ Failed to load OpenCV.js from: ${script.src}`)
          urlIndex++
          tryLoadScript()
        }
        
        script.async = true
        document.head.appendChild(script)
      }
      
      tryLoadScript()
    })
  }

  async segmentPanels(imageBase64: string): Promise<PanelSegmentationResult> {
    if (!this.isInitialized) {
      await this.initializeOpenCV()
    }

    try {
      console.log('🔍 Starting client-side panel segmentation...')
      
      // Convert base64 to image
      const img = await this.base64ToImage(imageBase64)
      const canvas = this.imageToCanvas(img)
      
      // Convert to OpenCV Mat
      const src = this.cv.imread(canvas)
      const originalHeight = src.rows
      const originalWidth = src.cols
      
      console.log(`📊 Image dimensions: ${originalWidth}x${originalHeight}`)
      
      // Remove black borders
      const { croppedMat, cropInfo } = this.removeBlackBorders(src)
      
      // Try contour-based detection first
      const contourPanels = this.detectPanelsContourBased(croppedMat)
      console.log(`🎯 Contour-based detection found ${contourPanels.length} panels`)
      
      let panels: SegmentedPanel[] = []
      
      if (contourPanels.length > 0) {
        console.log(`✅ Found ${contourPanels.length} panels using contour detection`)
        panels = this.createPanelData(contourPanels, src, cropInfo, originalWidth, originalHeight)
      } else {
        console.log('🔄 Falling back to line-based detection')
        const linePanels = this.detectPanelsLineBased(croppedMat)
        console.log(`📏 Line-based detection found ${linePanels.length} panels`)
        
        if (linePanels.length > 0) {
          panels = this.createPanelData(linePanels, src, cropInfo, originalWidth, originalHeight)
        } else {
          console.log('🔄 Final fallback to relaxed contour detection')
          const relaxedPanels = this.detectPanelsContourBasedRelaxed(croppedMat)
          console.log(`🎯 Relaxed detection found ${relaxedPanels.length} panels`)
          panels = this.createPanelData(relaxedPanels, src, cropInfo, originalWidth, originalHeight)
        }
      }
      
      // Sort panels for manga reading order (right-to-left, top-to-bottom)
      panels.sort((a, b) => {
        const yDiff = a.boundingBox.y - b.boundingBox.y
        if (Math.abs(yDiff) < 50) { // Same row
          return b.boundingBox.x - a.boundingBox.x // Right to left
        }
        return yDiff // Top to bottom
      })
      
      // Update reading order
      const readingOrder = panels.map((_, index) => index + 1)
      
      // Clean up
      src.delete()
      croppedMat.delete()
      
      const result: PanelSegmentationResult = {
        panels,
        totalPanels: panels.length,
        originalImage: {
          width: originalWidth,
          height: originalHeight
        },
        readingOrder
      }
      
      console.log('✅ Client-side panel segmentation complete:', {
        totalPanels: result.totalPanels,
        readingOrder: result.readingOrder
      })
      
      return result
      
    } catch (error) {
      console.error('❌ Client-side panel segmentation failed:', error)
      throw new Error(`Panel segmentation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private removeBlackBorders(src: any): { croppedMat: any, cropInfo: { x: number, y: number, width: number, height: number } } {
    // Convert to grayscale
    const gray = new this.cv.Mat()
    this.cv.cvtColor(src, gray, this.cv.COLOR_RGB2GRAY)
    
    // Threshold to find non-black areas
    const thresh = new this.cv.Mat()
    this.cv.threshold(gray, thresh, 10, 255, this.cv.THRESH_BINARY)
    
    // Find contours
    const contours = new this.cv.MatVector()
    const hierarchy = new this.cv.Mat()
    this.cv.findContours(thresh, contours, hierarchy, this.cv.RETR_EXTERNAL, this.cv.CHAIN_APPROX_SIMPLE)
    
    let maxArea = 0
    let maxRect = { x: 0, y: 0, width: src.cols, height: src.rows }
    
    // Find the largest contour (main content area)
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i)
      const rect = this.cv.boundingRect(contour)
      const area = rect.width * rect.height
      
      if (area > maxArea) {
        maxArea = area
        maxRect = rect
      }
      contour.delete()
    }
    
    // Add small padding
    const padding = 10
    maxRect.x = Math.max(0, maxRect.x - padding)
    maxRect.y = Math.max(0, maxRect.y - padding)
    maxRect.width = Math.min(src.cols - maxRect.x, maxRect.width + 2 * padding)
    maxRect.height = Math.min(src.rows - maxRect.y, maxRect.height + 2 * padding)
    
    // Crop the image
    const croppedMat = src.roi(new this.cv.Rect(maxRect.x, maxRect.y, maxRect.width, maxRect.height))
    
    // Clean up
    gray.delete()
    thresh.delete()
    contours.delete()
    hierarchy.delete()
    
    return {
      croppedMat,
      cropInfo: maxRect
    }
  }

  private detectPanelsContourBased(src: any): Array<{ x: number, y: number, width: number, height: number }> {
    // Convert to grayscale
    const gray = new this.cv.Mat()
    this.cv.cvtColor(src, gray, this.cv.COLOR_RGB2GRAY)
    
    const panels: Array<{ x: number, y: number, width: number, height: number }> = []
    const imageArea = src.rows * src.cols
    
    // Method 1: Edge detection + contours (more aggressive for corner panels)
    const edges = new this.cv.Mat()
    this.cv.Canny(gray, edges, 30, 120, 3, false) // Much lower thresholds to catch weak edges
    
    // Use smaller kernel and fewer iterations to avoid connecting internal edges
    const kernel1 = this.cv.getStructuringElement(this.cv.MORPH_RECT, new this.cv.Size(2, 2))
    const dilated1 = new this.cv.Mat()
    this.cv.dilate(edges, dilated1, kernel1, new this.cv.Point(-1, -1), 1)
    
    // Apply morphological closing to connect panel borders but not internal features
    const kernel2 = this.cv.getStructuringElement(this.cv.MORPH_RECT, new this.cv.Size(3, 3)) // Smaller kernel
    const closed = new this.cv.Mat()
    this.cv.morphologyEx(dilated1, closed, this.cv.MORPH_CLOSE, kernel2)
    
    // Find contours from edges
    const contours1 = new this.cv.MatVector()
    const hierarchy1 = new this.cv.Mat()
    this.cv.findContours(closed, contours1, hierarchy1, this.cv.RETR_EXTERNAL, this.cv.CHAIN_APPROX_SIMPLE)
    
    // Extremely aggressive filtering to catch missing corner panels
    const minArea = imageArea * 0.001 // Reduced to 0.1% of image area
    const maxArea = imageArea * 0.98  // Increased to 98% of image area
    
    console.log(`🔍 Method 1: Found ${contours1.size()} contours, filtering by area ${minArea} - ${maxArea}`)
    
    for (let i = 0; i < contours1.size(); i++) {
      const contour = contours1.get(i)
      const area = this.cv.contourArea(contour)
      if (minArea < area && area < maxArea) {
        const rect = this.cv.boundingRect(contour)
        // Very permissive size requirements to catch tiny corner panels
        if (rect.width > 20 && rect.height > 20) {
          const aspectRatio = rect.width / rect.height
          // More permissive aspect ratio range
          if (aspectRatio > 0.1 && aspectRatio < 20) {
            // Extremely lenient panel validation - prioritize corner panels
            const nearEdge = (rect.x < 50 || rect.y < 50 || 
                            rect.x + rect.width > src.cols - 50 || 
                            rect.y + rect.height > src.rows - 50)
            const largeEnough = area > imageArea * 0.003 // Much lower threshold
            const reasonableSize = rect.width > 30 || rect.height > 30 // Accept very small panels
            
            // Special priority for corner panels
            const inCorner = (rect.x < 100 && rect.y < 100) || // Top-left corner
                           (rect.x + rect.width > src.cols - 100 && rect.y < 100) || // Top-right corner
                           (rect.x < 100 && rect.y + rect.height > src.rows - 100) || // Bottom-left corner
                           (rect.x + rect.width > src.cols - 100 && rect.y + rect.height > src.rows - 100) // Bottom-right corner
            
            if (nearEdge || largeEnough || reasonableSize || inCorner) {
              panels.push({
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
              })
              console.log(`✅ Method 1: Added panel ${rect.width}x${rect.height} at (${rect.x}, ${rect.y})${inCorner ? ' [CORNER]' : ''}`)
            }
          }
        }
      }
      contour.delete()
    }
    
    // Method 2: Adaptive threshold if edge detection didn't work well
    if (panels.length < 2) {
      console.log('🔄 Method 1 insufficient, trying adaptive threshold')
      
      const blurred = new this.cv.Mat()
      this.cv.GaussianBlur(gray, blurred, new this.cv.Size(5, 5), 0)
      
      // Try more aggressive threshold methods to catch missing panels
      const blockSizes = [11, 15, 21, 25] // Added more block sizes
      const cValues = [3, 5, 8, 12] // Added more C values
      
      for (const blockSize of blockSizes) {
        for (const cValue of cValues) {
          const thresh = new this.cv.Mat()
          this.cv.adaptiveThreshold(blurred, thresh, 255, this.cv.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                   this.cv.THRESH_BINARY_INV, blockSize, cValue)
          
          // Lighter morphological operations to preserve smaller features
          const kernel3 = this.cv.getStructuringElement(this.cv.MORPH_RECT, new this.cv.Size(5, 5))
          const cleaned1 = new this.cv.Mat()
          const cleaned2 = new this.cv.Mat()
          this.cv.morphologyEx(thresh, cleaned1, this.cv.MORPH_CLOSE, kernel3)
          this.cv.morphologyEx(cleaned1, cleaned2, this.cv.MORPH_OPEN, kernel3)
          
          // Find contours
          const contours2 = new this.cv.MatVector()
          const hierarchy2 = new this.cv.Mat()
          this.cv.findContours(cleaned2, contours2, hierarchy2, this.cv.RETR_EXTERNAL, this.cv.CHAIN_APPROX_SIMPLE)
          
          for (let i = 0; i < contours2.size(); i++) {
            const contour = contours2.get(i)
            const area = this.cv.contourArea(contour)
            if (minArea < area && area < maxArea) {
              const rect = this.cv.boundingRect(contour)
              // More aggressive size requirements
              if (rect.width > 40 && rect.height > 40) {
                const aspectRatio = rect.width / rect.height
                // More permissive aspect ratio
                if (aspectRatio > 0.1 && aspectRatio < 25) {
                  // More lenient duplicate checking
                  const isDuplicate = panels.some(existingPanel => {
                    const overlapArea = this.calculateOverlapArea(rect, existingPanel)
                    const currentArea = rect.width * rect.height
                    return overlapArea > currentArea * 0.7 // Increased threshold
                  })
                  
                  if (!isDuplicate) {
                    panels.push({
                      x: rect.x,
                      y: rect.y,
                      width: rect.width,
                      height: rect.height
                    })
                    console.log(`✅ Method 2: Added panel ${rect.width}x${rect.height} at (${rect.x}, ${rect.y})`)
                  }
                }
              }
            }
            contour.delete()
          }
          
          // Clean up
          thresh.delete()
          cleaned1.delete()
          cleaned2.delete()
          contours2.delete()
          hierarchy2.delete()
          kernel3.delete()
          
          if (panels.length >= 3) break
        }
        if (panels.length >= 3) break
      }
      
      blurred.delete()
    }
    
    // Remove overlapping boxes (keep larger ones) - like Python implementation
    const filteredPanels: Array<{ x: number, y: number, width: number, height: number }> = []
    const sortedPanels = [...panels].sort((a, b) => (b.width * b.height) - (a.width * a.height))
    
    for (const panel of sortedPanels) {
      const isOverlapping = filteredPanels.some(existingPanel => {
        const overlapArea = this.calculateOverlapArea(panel, existingPanel)
        const currentArea = panel.width * panel.height
        return overlapArea > currentArea * 0.3 // 30% overlap threshold
      })
      
      if (!isOverlapping) {
        filteredPanels.push(panel)
      }
    }
    
    // Clean up
    gray.delete()
    edges.delete()
    kernel1.delete()
    kernel2.delete()
    closed.delete()
    dilated1.delete()
    contours1.delete()
    hierarchy1.delete()
    
    return filteredPanels
  }

  private detectPanelsContourBasedRelaxed(src: any): Array<{ x: number, y: number, width: number, height: number }> {
    // Convert to grayscale
    const gray = new this.cv.Mat()
    this.cv.cvtColor(src, gray, this.cv.COLOR_RGB2GRAY)
    
    // Apply Gaussian blur for smoother detection
    const blurred = new this.cv.Mat()
    this.cv.GaussianBlur(gray, blurred, new this.cv.Size(7, 7), 0)
    
    // More relaxed edge detection
    const edges = new this.cv.Mat()
    this.cv.Canny(blurred, edges, 20, 60)
    
    // Stronger morphological operations
    const kernel1 = this.cv.getStructuringElement(this.cv.MORPH_RECT, new this.cv.Size(5, 5))
    const kernel2 = this.cv.getStructuringElement(this.cv.MORPH_RECT, new this.cv.Size(7, 7))
    
    const closed = new this.cv.Mat()
    this.cv.morphologyEx(edges, closed, this.cv.MORPH_CLOSE, kernel1)
    
    const dilated = new this.cv.Mat()
    this.cv.dilate(closed, dilated, kernel2, new this.cv.Point(-1, -1), 2)
    
    // Find contours
    const contours = new this.cv.MatVector()
    const hierarchy = new this.cv.Mat()
    this.cv.findContours(dilated, contours, hierarchy, this.cv.RETR_EXTERNAL, this.cv.CHAIN_APPROX_SIMPLE)
    
    const panels: Array<{ x: number, y: number, width: number, height: number }> = []
    const imageArea = src.rows * src.cols
    const minArea = imageArea * 0.002 // Even more aggressive minimum area (0.2%)
    const maxArea = imageArea * 0.85   // Increased maximum area (85%)
    
    console.log(`🔍 Relaxed detection found ${contours.size()} contours, filtering by area ${minArea} - ${maxArea}`)
    
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i)
      const rect = this.cv.boundingRect(contour)
      const area = rect.width * rect.height
      const aspectRatio = rect.width / rect.height
      
      // Extremely relaxed filtering to catch missing panels
      const isValidSize = area > minArea && area < maxArea
      const isValidDimensions = rect.width > 25 && rect.height > 25 // Much smaller minimum
      const isValidAspectRatio = aspectRatio > 0.1 && aspectRatio < 15.0 // Much wider range
      
      if (isValidSize && isValidDimensions && isValidAspectRatio) {
        // Very lenient overlap checking
        const overlapsExisting = panels.some(existingPanel => {
          const overlapArea = this.calculateOverlapArea(rect, existingPanel)
          const overlapRatio = overlapArea / Math.min(area, existingPanel.width * existingPanel.height)
          return overlapRatio > 0.8 // Even higher tolerance for overlaps
        })
        
        if (!overlapsExisting) {
          panels.push({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          })
          console.log(`✅ Added relaxed panel: ${rect.width}x${rect.height} at (${rect.x}, ${rect.y}), area: ${area}`)
        }
      }
      contour.delete()
    }
    
    // Clean up
    gray.delete()
    blurred.delete()
    edges.delete()
    kernel1.delete()
    kernel2.delete()
    closed.delete()
    dilated.delete()
    contours.delete()
    hierarchy.delete()
    
    return panels
  }

  private detectPanelsLineBased(src: any): Array<{ x: number, y: number, width: number, height: number }> {
    // Convert to grayscale
    const gray = new this.cv.Mat()
    this.cv.cvtColor(src, gray, this.cv.COLOR_RGB2GRAY)
    
    // Dynamic parameters based on image size (from Python implementation)
    const imageArea = src.rows * src.cols
    const minLineLength = Math.max(100, Math.min(src.rows, src.cols) * 0.15)
    const maxLineGap = Math.max(10, Math.min(src.rows, src.cols) * 0.02)
    const houghThreshold = Math.max(50, Math.sqrt(imageArea) * 0.1)
    const angleDeviation = 5 // degrees
    const parallelMergeDistance = Math.max(15, Math.min(src.rows, src.cols) * 0.02)
    
    console.log(`📏 Dynamic params: minLineLength=${minLineLength}, maxLineGap=${maxLineGap}, houghThreshold=${houghThreshold}`)
    
    // Edge detection with optimized parameters
    const edges = new this.cv.Mat()
    this.cv.Canny(gray, edges, 50, 150, 3, false)
    
    // Detect lines using HoughLinesP with dynamic parameters
    const lines = new this.cv.Mat()
    this.cv.HoughLinesP(edges, lines, 1, Math.PI / 180, houghThreshold, minLineLength, maxLineGap)
    
    console.log(`📏 Detected ${lines.rows} lines with dynamic parameters`)
    
    // Separate and filter lines by angle (more precise like Python)
    const horizontalLines: Array<{x1: number, y1: number, x2: number, y2: number, length: number}> = []
    const verticalLines: Array<{x1: number, y1: number, x2: number, y2: number, length: number}> = []
    
    for (let i = 0; i < lines.rows; i++) {
      const x1 = lines.data32S[i * 4]
      const y1 = lines.data32S[i * 4 + 1]
      const x2 = lines.data32S[i * 4 + 2]
      const y2 = lines.data32S[i * 4 + 3]
      
      const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI
      const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
      
      // More precise angle filtering like Python implementation
      if (Math.abs(angle) <= angleDeviation || Math.abs(angle) >= (180 - angleDeviation)) {
        // Horizontal line
        horizontalLines.push({x1, y1, x2, y2, length})
      } else if (Math.abs(Math.abs(angle) - 90) <= angleDeviation) {
        // Vertical line  
        verticalLines.push({x1, y1, x2, y2, length})
      }
    }
    
    console.log(`📏 Angle-filtered lines: ${horizontalLines.length} horizontal, ${verticalLines.length} vertical`)
    
    // Merge collinear line segments (like Python merge_line function)
    const mergedHorizontalSegments = this.mergeCollinearLines(horizontalLines, true)
    const mergedVerticalSegments = this.mergeCollinearLines(verticalLines, false)
    
    console.log(`📏 After collinear merge: ${mergedHorizontalSegments.length} horizontal, ${mergedVerticalSegments.length} vertical`)
    
    // Filter by length thresholds (like Python implementation)
    const horizontalThreshold = src.cols * 0.3
    const verticalThreshold = src.rows * 0.3
    
    const filteredHorizontal = mergedHorizontalSegments.filter(line => line.length >= horizontalThreshold)
    const filteredVertical = mergedVerticalSegments.filter(line => line.length >= verticalThreshold)
    
    console.log(`📏 After length filtering: ${filteredHorizontal.length} horizontal, ${filteredVertical.length} vertical`)
    
    // Extract cutting positions
    const horizontalCuts = filteredHorizontal.map(line => (line.y1 + line.y2) / 2)
    let verticalCuts = filteredVertical.map(line => (line.x1 + line.x2) / 2)
    
    // Filter vertical lines based on image borders (like Python verticalcuts function)
    const borderThreshold = 20
    verticalCuts = verticalCuts.filter(x => x > borderThreshold && x < src.cols - borderThreshold)
    
    // Merge parallel lines (like Python new_parallel_merge function)
    const mergedHorizontalCuts = this.mergeParallelPositions(horizontalCuts, parallelMergeDistance)
    const mergedVerticalCuts = this.mergeParallelPositions(verticalCuts, parallelMergeDistance)
    
    console.log(`📏 Final cuts: ${mergedHorizontalCuts.length} horizontal, ${mergedVerticalCuts.length} vertical`)
    
    // Add image boundaries
    const allHorizontalCuts = [0, ...mergedHorizontalCuts, src.rows].sort((a, b) => a - b)
    const allVerticalCuts = [0, ...mergedVerticalCuts, src.cols].sort((a, b) => a - b)
    
    // Generate panels like Python implementation
    const panels: Array<{ x: number, y: number, width: number, height: number }> = []
    
    for (let i = 0; i < allHorizontalCuts.length - 1; i++) {
      const y1 = Math.round(allHorizontalCuts[i])
      const y2 = Math.round(allHorizontalCuts[i + 1])
      const height = y2 - y1
      
      if (height < 30) continue // More aggressive - allow thinner horizontal sections
      
      for (let j = 0; j < allVerticalCuts.length - 1; j++) {
        const x1 = Math.round(allVerticalCuts[j])
        const x2 = Math.round(allVerticalCuts[j + 1])
        const width = x2 - x1
        
        if (width < 30) continue // More aggressive - allow thinner vertical sections
        
        // More permissive validation to catch missing panels
        const area = width * height
        const aspectRatio = width / height
        const minArea = imageArea * 0.003 // Reduced to 0.3% of image area
        
        // More permissive conditions
        if (area > minArea && aspectRatio > 0.05 && aspectRatio < 20) {
          panels.push({
            x: x1,
            y: y1,
            width: width,
            height: height
          })
          console.log(`✅ Line-based: Added panel ${width}x${height} at (${x1}, ${y1})`)
        }
      }
    }
    
    // Clean up
    gray.delete()
    edges.delete()
    lines.delete()
    
    return panels
  }

  private createGridPanels(
    horizontalLines: Array<{ x1: number, y1: number, x2: number, y2: number, length: number }>,
    verticalLines: Array<{ x1: number, y1: number, x2: number, y2: number, length: number }>,
    width: number,
    height: number
  ): Array<{ x: number, y: number, width: number, height: number }> {
    // Merge similar lines to reduce noise
    const mergedHorizontalLines = this.mergeParallelLines(horizontalLines, true)
    const mergedVerticalLines = this.mergeParallelLines(verticalLines, false)
    
    console.log(`🔧 Merged to ${mergedHorizontalLines.length} horizontal and ${mergedVerticalLines.length} vertical lines`)
    
    // Extract unique y-coordinates from horizontal lines with clustering
    const yCoords = [0, height]
    mergedHorizontalLines.forEach(line => {
      const y = Math.round((line.y1 + line.y2) / 2)
      if (!yCoords.includes(y)) yCoords.push(y)
    })
    yCoords.sort((a, b) => a - b)
    
    // Extract unique x-coordinates from vertical lines with clustering
    const xCoords = [0, width]
    mergedVerticalLines.forEach(line => {
      const x = Math.round((line.x1 + line.x2) / 2)
      if (!xCoords.includes(x)) xCoords.push(x)
    })
    xCoords.sort((a, b) => a - b)
    
    const panels: Array<{ x: number, y: number, width: number, height: number }> = []
    
    // Create panels from grid intersections
    for (let i = 0; i < yCoords.length - 1; i++) {
      for (let j = 0; j < xCoords.length - 1; j++) {
        const x = xCoords[j]
        const y = yCoords[i]
        const w = xCoords[j + 1] - x
        const h = yCoords[i + 1] - y
        
        // Filter out very small panels
        if (w > 50 && h > 50) {
          panels.push({ x, y, width: w, height: h })
        }
      }
    }
    
    return panels
  }

  private calculateOverlapArea(
    rect1: { x: number, y: number, width: number, height: number },
    rect2: { x: number, y: number, width: number, height: number }
  ): number {
    const x1 = Math.max(rect1.x, rect2.x)
    const y1 = Math.max(rect1.y, rect2.y)
    const x2 = Math.min(rect1.x + rect1.width, rect2.x + rect2.width)
    const y2 = Math.min(rect1.y + rect1.height, rect2.y + rect2.height)
    
    if (x2 <= x1 || y2 <= y1) {
      return 0 // No overlap
    }
    
    return (x2 - x1) * (y2 - y1)
  }

  // Merge collinear line segments (based on Python merge_line function)
  private mergeCollinearLines(
    lines: Array<{x1: number, y1: number, x2: number, y2: number, length: number}>,
    isHorizontal: boolean
  ): Array<{x1: number, y1: number, x2: number, y2: number, length: number}> {
    if (lines.length === 0) return []
    
    const merged: Array<{x1: number, y1: number, x2: number, y2: number, length: number}> = []
    const used = new Set<number>()
    const collinearThreshold = 10 // pixels
    
    for (let i = 0; i < lines.length; i++) {
      if (used.has(i)) continue
      
      const line1 = lines[i]
      const group = [line1]
      used.add(i)
      
      for (let j = i + 1; j < lines.length; j++) {
        if (used.has(j)) continue
        
        const line2 = lines[j]
        
        // Check if lines are collinear (based on Python in_line function)
        let areCollinear = false
        if (isHorizontal) {
          // For horizontal lines, check if y-coordinates are similar
          const avgY1 = (line1.y1 + line1.y2) / 2
          const avgY2 = (line2.y1 + line2.y2) / 2
          areCollinear = Math.abs(avgY1 - avgY2) <= collinearThreshold
        } else {
          // For vertical lines, check if x-coordinates are similar
          const avgX1 = (line1.x1 + line1.x2) / 2
          const avgX2 = (line2.x1 + line2.x2) / 2
          areCollinear = Math.abs(avgX1 - avgX2) <= collinearThreshold
        }
        
        if (areCollinear) {
          group.push(line2)
          used.add(j)
        }
      }
      
      // Merge collinear lines in the group
      if (isHorizontal) {
        const avgY = group.reduce((sum, line) => sum + (line.y1 + line.y2) / 2, 0) / group.length
        const minX = Math.min(...group.map(line => Math.min(line.x1, line.x2)))
        const maxX = Math.max(...group.map(line => Math.max(line.x1, line.x2)))
        const length = maxX - minX
        merged.push({x1: minX, y1: avgY, x2: maxX, y2: avgY, length})
      } else {
        const avgX = group.reduce((sum, line) => sum + (line.x1 + line.x2) / 2, 0) / group.length
        const minY = Math.min(...group.map(line => Math.min(line.y1, line.y2)))
        const maxY = Math.max(...group.map(line => Math.max(line.y1, line.y2)))
        const length = maxY - minY
        merged.push({x1: avgX, y1: minY, x2: avgX, y2: maxY, length})
      }
    }
    
    return merged
  }
  
  // Merge parallel positions (based on Python new_parallel_merge function)
  private mergeParallelPositions(positions: number[], threshold: number): number[] {
    if (positions.length === 0) return []
    
    const sorted = [...positions].sort((a, b) => a - b)
    const merged: number[] = []
    
    let currentGroup = [sorted[0]]
    
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] <= threshold) {
        // Add to current group
        currentGroup.push(sorted[i])
      } else {
        // Finalize current group and start new one
        const avgPosition = currentGroup.reduce((sum, pos) => sum + pos, 0) / currentGroup.length
        merged.push(avgPosition)
        currentGroup = [sorted[i]]
      }
    }
    
    // Don't forget the last group
    if (currentGroup.length > 0) {
      const avgPosition = currentGroup.reduce((sum, pos) => sum + pos, 0) / currentGroup.length
      merged.push(avgPosition)
    }
    
    return merged
  }

  private mergeParallelLines(
    lines: Array<{ x1: number, y1: number, x2: number, y2: number, length: number }>,
    isHorizontal: boolean
  ): Array<{ x1: number, y1: number, x2: number, y2: number, length: number }> {
    if (lines.length === 0) return []
    
    const merged: Array<{ x1: number, y1: number, x2: number, y2: number, length: number }> = []
    const threshold = 20 // Distance threshold for merging parallel lines
    
    for (const line of lines) {
      let wasMerged = false
      
      for (const mergedLine of merged) {
        const distance = isHorizontal 
          ? Math.abs((line.y1 + line.y2) / 2 - (mergedLine.y1 + mergedLine.y2) / 2)
          : Math.abs((line.x1 + line.x2) / 2 - (mergedLine.x1 + mergedLine.x2) / 2)
        
        if (distance < threshold) {
          // Merge lines by extending the longer one or averaging positions
          if (isHorizontal) {
            mergedLine.x1 = Math.min(mergedLine.x1, line.x1)
            mergedLine.x2 = Math.max(mergedLine.x2, line.x2)
            mergedLine.y1 = (mergedLine.y1 + line.y1) / 2
            mergedLine.y2 = (mergedLine.y2 + line.y2) / 2
          } else {
            mergedLine.y1 = Math.min(mergedLine.y1, line.y1)
            mergedLine.y2 = Math.max(mergedLine.y2, line.y2)
            mergedLine.x1 = (mergedLine.x1 + line.x1) / 2
            mergedLine.x2 = (mergedLine.x2 + line.x2) / 2
          }
          mergedLine.length = Math.sqrt(
            (mergedLine.x2 - mergedLine.x1) ** 2 + (mergedLine.y2 - mergedLine.y1) ** 2
          )
          wasMerged = true
          break
        }
      }
      
      if (!wasMerged) {
        merged.push({ ...line })
      }
    }
    
    return merged
  }

  private filterOverlappingPanels(panels: Array<{ x: number, y: number, width: number, height: number }>): Array<{ x: number, y: number, width: number, height: number }> {
    const filtered: Array<{ x: number, y: number, width: number, height: number }> = []
    
    for (const panel of panels) {
      let isOverlapping = false
      
      for (const existing of filtered) {
        const overlapX = Math.max(0, Math.min(panel.x + panel.width, existing.x + existing.width) - Math.max(panel.x, existing.x))
        const overlapY = Math.max(0, Math.min(panel.y + panel.height, existing.y + existing.height) - Math.max(panel.y, existing.y))
        const overlapArea = overlapX * overlapY
        const panelArea = panel.width * panel.height
        const existingArea = existing.width * existing.height
        
        // If overlap is more than 50% of either panel, consider it overlapping
        if (overlapArea > 0.5 * Math.min(panelArea, existingArea)) {
          isOverlapping = true
          break
        }
      }
      
      if (!isOverlapping) {
        filtered.push(panel)
      }
    }
    
    return filtered
  }

  private createPanelData(
    panelRects: Array<{ x: number, y: number, width: number, height: number }>,
    originalMat: any,
    cropInfo: { x: number, y: number, width: number, height: number },
    originalWidth: number,
    originalHeight: number
  ): SegmentedPanel[] {
    const panels: SegmentedPanel[] = []
    
    for (let i = 0; i < panelRects.length; i++) {
      const rect = panelRects[i]
      
      // Adjust coordinates back to original image space
      const origX = rect.x + cropInfo.x
      const origY = rect.y + cropInfo.y
      
      // Ensure coordinates are within bounds
      const clampedX = Math.max(0, Math.min(origX, originalWidth - 1))
      const clampedY = Math.max(0, Math.min(origY, originalHeight - 1))
      const clampedW = Math.min(rect.width, originalWidth - clampedX)
      const clampedH = Math.min(rect.height, originalHeight - clampedY)
      
      // Extract panel from original image
      const panelRoi = originalMat.roi(new this.cv.Rect(clampedX, clampedY, clampedW, clampedH))
      
      // Convert to base64
      const canvas = document.createElement('canvas')
      this.cv.imshow(canvas, panelRoi)
      const imageData = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
      
      panels.push({
        id: `panel_${i}`,
        boundingBox: {
          x: clampedX,
          y: clampedY,
          width: clampedW,
          height: clampedH
        },
        imageData,
        readingOrderIndex: i
      })
      
      panelRoi.delete()
    }
    
    return panels
  }

  private base64ToImage(base64: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      
      // Handle data URL or raw base64
      if (base64.startsWith('data:')) {
        img.src = base64
      } else {
        img.src = `data:image/jpeg;base64,${base64}`
      }
    })
  }

  private imageToCanvas(img: HTMLImageElement): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    canvas.width = img.width
    canvas.height = img.height
    ctx.drawImage(img, 0, 0)
    return canvas
  }

  isAvailable(): boolean {
    return typeof window !== 'undefined'
  }

  async initialize(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeOpenCV()
    }
  }
}