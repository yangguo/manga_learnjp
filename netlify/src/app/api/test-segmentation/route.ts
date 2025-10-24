import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing panel segmentation...')
    
    const { imageBase64 } = await request.json()
    
    if (!imageBase64) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 })
    }

    // Import the panel segmentation service
    const { PanelSegmentationService } = await import('@/lib/panel-segmentation-service')
    const segmentationService = new PanelSegmentationService()
    
    console.log('🔍 Starting segmentation test...')
    const result = await segmentationService.segmentPanels(imageBase64)
    
    console.log('✅ Segmentation test result:', {
      panelCount: result.panels.length,
      hasImageData: result.panels.map(p => !!p.imageData),
      readingOrder: result.readingOrder
    })

    return NextResponse.json({
      success: true,
      panelCount: result.panels.length,
      panelsWithImages: result.panels.filter(p => p.imageData).length,
      readingOrder: result.readingOrder,
      samplePanelData: result.panels.length > 0 ? {
        hasImageData: !!result.panels[0].imageData,
        imageDataLength: result.panels[0].imageData?.length || 0,
        boundingBox: result.panels[0].boundingBox
      } : null
    })

  } catch (error) {
    console.error('❌ Panel segmentation test failed:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false 
    }, { status: 500 })
  }
}
