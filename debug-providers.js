#!/usr/bin/env node

// Simple script to debug AI provider configuration
console.log('🔍 Debugging AI Providers...\n')

// Check environment variables
console.log('📋 Environment Variables:')
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set')
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Not set')
console.log()

// Check if Ollama is running
console.log('🤖 Checking Ollama...')
fetch('http://localhost:11434/api/tags')
  .then(response => {
    if (response.ok) {
      console.log('✅ Ollama is running on localhost:11434')
      return response.json()
    } else {
      console.log('❌ Ollama is not responding properly')
      return null
    }
  })
  .then(data => {
    if (data && data.models) {
      console.log('📦 Available Ollama models:')
      data.models.forEach(model => {
        console.log(`   - ${model.name}`)
      })
    }
  })
  .catch(error => {
    console.log('❌ Ollama is not running or not accessible')
    console.log('   To start Ollama: ollama serve')
    console.log('   To install llava: ollama pull llava')
  })

console.log('\n💡 Solutions:')
console.log('1. If you have OpenAI API key: Use "OpenAI" provider in settings')
console.log('2. If you have Gemini API key: Use "Gemini" provider in settings') 
console.log('3. If using Ollama: Make sure it\'s running with "ollama serve"')
console.log('4. If using other service: Update the endpoint in "Custom OpenAI-format" settings')
