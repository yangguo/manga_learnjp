# Manga Learn JP

A modern, beautiful web application for learning Japanese through manga using AI vision models for text extraction and analysis.

## Features

🎌 **Upload Manga Images**: Drag & drop or select manga pages  
📖 **Automatic Panel Segmentation**: Advanced computer vision to detect and segment manga panels  
🔄 **Reading Order Detection**: Automatically orders panels following traditional manga reading sequence (right-to-left, top-to-bottom)  
🤖 **AI Vision OCR**: Extract Japanese text using advanced LLM vision models (GPT-4 Vision, Gemini Vision)  
🔍 **Panel-by-Panel Analysis**: Individual analysis of each segmented panel for better accuracy  
📚 **Vocabulary Breakdown**: Learn new words with readings, meanings, and difficulty levels  
📖 **Grammar Patterns**: Understand sentence structures and patterns  
🎨 **Beautiful UI**: Modern, responsive design with smooth animations  
📱 **Mobile Friendly**: Works great on all devices  
🔧 **Multiple AI Providers**: Support for OpenAI, Google Gemini, and custom OpenAI-format APIs

## AI Provider Options

### 1. OpenAI GPT-4 Vision
- High accuracy Japanese text recognition
- Excellent contextual understanding
- Requires OpenAI API key

### 2. Google Gemini Vision  
- Strong multilingual capabilities
- Good manga text recognition
- Requires Gemini API key

### 3. OpenAI-Format APIs (Custom)
- Use local models like Ollama, LM Studio
- Compatible with any OpenAI-format API
- Configurable endpoint and model
- Optional API key support

## Technology Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS with custom components  
- **AI Vision**: OpenAI GPT-4 Vision, Google Gemini Vision, Custom APIs
- **State Management**: Zustand
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **File Upload**: React Dropzone

## Getting Started

### Prerequisites

- Node.js 18+ 
- OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd manga_learnjp
```

2. Install dependencies:
```bash
npm install
```

3. Create environment variables:
```bash
cp .env.example .env.local
```

4. Configure your AI provider(s) in `.env.local`:
```bash
# OpenAI (recommended)
OPENAI_API_KEY=your_openai_api_key_here

# Google Gemini (alternative)
GEMINI_API_KEY=your_gemini_api_key_here

# Set default provider
NEXT_PUBLIC_DEFAULT_AI_PROVIDER=openai
```

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Model Configuration

You can configure specific models for each AI provider in the Settings panel:

### OpenAI Models
- **Text Analysis**: Choose between GPT-4 Turbo, GPT-4, or GPT-3.5 Turbo
- **Vision Analysis**: Select GPT-4 Vision, GPT-4o, or GPT-4o Mini

### Gemini Models  
- **Unified Model**: Choose Gemini 1.5 Pro (recommended), Gemini 1.5 Flash, or Gemini Pro Vision

### Model Recommendations
- **Best Accuracy**: OpenAI GPT-4 Vision + GPT-4 Turbo
- **Best Speed**: Gemini 1.5 Flash or GPT-4o Mini  
- **Best Value**: GPT-3.5 Turbo + GPT-4o Mini

## Using Custom AI APIs (Ollama, LM Studio, etc.)

You can use any OpenAI-compatible API endpoint:

1. In the app, go to Settings (⚙️ icon)
2. Select "OpenAI-Format API" 
3. Configure your endpoint:
   - **Endpoint URL**: `http://localhost:11434/v1` (for Ollama)
   - **Model Name**: `llava:latest` (or your vision model)
   - **API Key**: Leave blank if not required

### Popular OpenAI-Format APIs:

- **Ollama**: `http://localhost:11434/v1` with models like `llava:latest`
- **LM Studio**: `http://localhost:1234/v1` with loaded vision models
- **vLLM**: Your custom vLLM endpoint
- **Any OpenAI-compatible API**

## Usage

1. **Upload Image**: Drag and drop a manga page or click to select from your computer
2. **AI Vision Analysis**: The app will automatically extract Japanese text from the image using advanced AI vision models
3. **AI Analysis**: Get detailed explanations of vocabulary and grammar patterns
4. **Learn**: Study the breakdown of words, meanings, and sentence structures

## Features in Detail

### AI Vision Text Extraction
- Supports multiple image formats (PNG, JPG, WebP, BMP)
- Uses advanced LLM vision models (GPT-4 Vision, Gemini Vision)
- Single-step text extraction and analysis for better accuracy
- Real-time progress feedback
- Automatic text cleaning and formatting
- Context-aware Japanese text recognition optimized for manga

### AI Analysis
- Vocabulary breakdown with hiragana readings
- English translations and meanings
- Part-of-speech identification
- Difficulty level classification (JLPT levels)
- Grammar pattern recognition
- Context-aware explanations
- Manga-specific language understanding

### User Interface
- Clean, modern design inspired by Japanese aesthetics
- Smooth animations and transitions
- Responsive layout for all devices
- Glass morphism effects
- Intuitive drag-and-drop interface
- Copy-to-clipboard functionality

## Panel Segmentation Technology

This application uses an advanced comic panel segmentation algorithm based on classical computer vision techniques:

- **Canny Edge Detection**: Identifies panel boundaries
- **Probabilistic Hough Transform**: Detects straight lines for panel borders  
- **Intelligent Line Merging**: Combines related line segments
- **Reading Order Algorithm**: Automatically orders panels for manga reading sequence
- **Bounding Box Generation**: Precise panel extraction coordinates

The segmentation algorithm is optimized for digital manga and comic formats, providing fast and accurate panel detection without requiring heavy machine learning models.

### Setup Panel Segmentation

1. **Install Python Dependencies**:
   ```bash
   ./setup_panel_segmentation.sh
   ```
   
   Or manually:
   ```bash
   pip3 install -r requirements.txt
   ```

2. **Verify Installation**:
   ```bash
   python3 -c "import numpy, cv2, PIL, skimage; print('OK')"
   ```

## API Endpoints

### POST /api/analyze
Analyzes Japanese text and returns detailed explanations.

**Request:**
```json
{
  "text": "Japanese text to analyze"
}
```

**Response:**
```json
{
  "translation": "English translation",
  "summary": "Context summary",
  "words": [
    {
      "word": "漫画",
      "reading": "まんが",
      "meaning": "manga; comic",
      "partOfSpeech": "noun",
      "difficulty": "beginner"
    }
  ],
  "grammar": [
    {
      "pattern": "Grammar pattern",
      "explanation": "Detailed explanation",
      "example": "Example sentence"
    }
  ]
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- OpenAI for GPT-4 Vision API
- Google for Gemini Vision API
- The open-source AI community for OpenAI-compatible APIs
- The Japanese language learning community
- Manga creators and publishers

---

**Happy learning! 頑張って！** 🎌