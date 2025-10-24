# Manga LearnJP - Netlify Version

This is the Netlify deployment version of the Manga LearnJP application, adapted from the original Vercel version.

## Key Differences from Vercel Version

### API Routes → Netlify Functions
- `/api/analyze` → `/.netlify/functions/analyze`
- `/api/providers` → `/.netlify/functions/providers`
- `/api/test-segmentation` → `/.netlify/functions/test-segmentation`
- `/api/segment-panels` → `/.netlify/functions/segment-panels`

### Configuration Files
- `netlify.toml` - Netlify deployment configuration
- Modified `next.config.js` for Netlify compatibility
- Updated `package.json` with Netlify-specific dependencies

### Functions Directory
All API routes have been converted to Netlify Functions in the `functions/` directory:
- `functions/analyze.ts` - Main analysis endpoint
- `functions/providers.ts` - Available AI providers endpoint
- `functions/test-segmentation.ts` - Panel segmentation testing
- `functions/segment-panels.ts` - Panel segmentation endpoint

## Deployment Instructions

### Prerequisites
1. Node.js 18 or higher
2. Netlify CLI (optional for local development)

### Environment Variables
Set the following environment variables in your Netlify dashboard:

```
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key
OPENAI_FORMAT_API_URL=your_openai_compatible_api_url
OPENAI_FORMAT_MODEL=your_openai_compatible_model
OPENAI_FORMAT_API_KEY=your_openai_compatible_api_key
```

### Local Development
1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run netlify-dev
   ```

### Deployment
1. Connect your repository to Netlify
2. Set the build command: `npm run build`
3. Set the publish directory: `.next`
4. Configure environment variables
5. Deploy!

## Features
- Japanese text analysis from manga images
- Panel segmentation and individual panel analysis
- Multiple AI provider support (OpenAI, Gemini, OpenAI-compatible APIs)
- Reading mode for continuous text analysis
- Responsive design optimized for mobile and desktop

## Technical Stack
- Next.js 15 (Static Export)
- TypeScript
- Tailwind CSS
- Netlify Functions
- OpenCV.js for image processing
- Framer Motion for animations

## Support
For issues specific to the Netlify deployment, please check:
1. Netlify function logs
2. Build logs
3. Environment variable configuration
4. CORS settings (handled automatically by functions)