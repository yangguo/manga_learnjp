import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  try {
    console.log('🧪 Testing panel segmentation...')
    
    const { imageBase64 } = JSON.parse(event.body || '{}')
    
    if (!imageBase64) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Image is required' }),
      }
    }

    // Import the panel segmentation service
    const { PanelSegmentationService } = await import('../src/lib/panel-segmentation-service')
    const segmentationService = new PanelSegmentationService()
    
    console.log('🔍 Starting segmentation test...')
    const result = await segmentationService.segmentPanels(imageBase64)
    
    console.log('✅ Segmentation test result:', {
      panelCount: result.panels.length,
      hasImageData: result.panels.map(p => !!p.imageData),
      readingOrder: result.readingOrder
    })

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        panelCount: result.panels.length,
        panelsWithImages: result.panels.filter(p => p.imageData).length,
        readingOrder: result.readingOrder,
        samplePanelData: result.panels.length > 0 ? {
          hasImageData: !!result.panels[0].imageData,
          imageDataLength: result.panels[0].imageData?.length || 0,
          boundingBox: result.panels[0].boundingBox
        } : null
      }),
    }

  } catch (error) {
    console.error('❌ Panel segmentation test failed:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
    }
  }
}