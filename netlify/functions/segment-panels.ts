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
    
    const result = await segmentationService.segmentPanels(imageBase64)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    }

  } catch (error) {
    console.error('Panel segmentation error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        panels: [],
        readingOrder: []
      }),
    }
  }
}