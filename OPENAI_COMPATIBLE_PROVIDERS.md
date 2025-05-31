# OpenAI-Compatible Providers

Your manga learning app now supports various OpenAI-compatible API providers. Here's how to configure them:

## Supported Providers

### 1. **Ollama (Local)**
- **Endpoint:** `http://localhost:11434/v1`
- **Example Models:** `llava:latest`, `llava:7b`, `llava:13b`
- **API Key:** Not required
- **Setup:** Install Ollama and run `ollama pull llava`

### 2. **LM Studio (Local)**
- **Endpoint:** `http://localhost:1234/v1`
- **Example Models:** Any vision model loaded in LM Studio
- **API Key:** Not required
- **Setup:** Download and start LM Studio with a vision model

### 3. **Together AI**
- **Endpoint:** `https://api.together.xyz/v1`
- **Example Models:** `meta-llama/Llama-Vision-Free`, `meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo`
- **API Key:** Required (get from together.ai)

### 4. **Anyscale**
- **Endpoint:** `https://api.endpoints.anyscale.com/v1`
- **Example Models:** `meta-llama/Llama-2-7b-chat-hf`
- **API Key:** Required (get from anyscale.com)

### 5. **Perplexity AI**
- **Endpoint:** `https://api.perplexity.ai`
- **Example Models:** `llava-v1.5-7b-wrapper`, `llava-v1.6-vicuna-7b`
- **API Key:** Required (get from perplexity.ai)

### 6. **Groq**
- **Endpoint:** `https://api.groq.com/openai/v1`
- **Example Models:** `llava-v1.5-7b-4096-preview`
- **API Key:** Required (get from groq.com)

### 7. **OpenAI (via OpenAI-Compatible)**
- **Endpoint:** `https://api.openai.com/v1`
- **Example Models:** `gpt-4-vision-preview`, `gpt-4o`
- **API Key:** Required (OpenAI API key)

## Configuration Steps

1. **Open Settings** in your manga learning app
2. **Select "OpenAI-Compatible"** as the provider
3. **Enter the endpoint URL** for your chosen provider
4. **Enter the model name** that supports vision/image analysis
5. **Add your API key** if required by the provider
6. **Test** by uploading a manga image

## Model Requirements

For manga image analysis, you need a model that supports:
- **Vision capabilities** (can process images)
- **Japanese text recognition** (OCR functionality)
- **Text analysis** (can understand and analyze Japanese)

## Troubleshooting

### Common Issues:
- **404 Error:** Check that the endpoint URL is correct and the service is running
- **401/403 Error:** Verify your API key is correct and has proper permissions
- **Model Not Found:** Ensure the model name is spelled correctly and available
- **Connection Refused:** For local providers (Ollama, LM Studio), ensure they are running

### Tips:
- Start with local providers (Ollama, LM Studio) for testing
- Use cloud providers (Together AI, Groq) for production
- Check provider documentation for the latest model names
- Some providers have rate limits or require payment
