import { NextRequest, NextResponse } from 'next/server'
import { PanelSegmentationService } from '@/lib/panel-segmentation-service'

interface SegmentationRequest {
  imageBase64?: string
}

export async function POST(request: NextRequest) {
  try {
    const { imageBase64 }: SegmentationRequest = await request.json()

    if (!imageBase64) {
      return NextResponse.json(
        { error: 'Image is required for panel segmentation' },
        { status: 400 }
      )
    }

    const segmentationService = new PanelSegmentationService()
    
    // Check if Python dependencies are available
    const dependenciesAvailable = await segmentationService.checkPythonDependencies()
    if (!dependenciesAvailable) {
      return NextResponse.json(
        { 
          error: 'Panel segmentation dependencies not installed. Please run: ./setup_panel_segmentation.sh',
          dependenciesInstalled: false
        },
        { status: 500 }
      )
    }

    const result = await segmentationService.segmentPanels(imageBase64)
    
    return NextResponse.json({
      ...result,
      dependenciesInstalled: true
    })

  } catch (error) {
    console.error('Panel segmentation error:', error)
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to segment panels',
      panels: [],
      totalPanels: 0,
      originalImage: { width: 0, height: 0 },
      readingOrder: [],
      dependenciesInstalled: false
    }, { status: 500 })
  }
}
