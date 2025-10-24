import { spawn } from 'child_process'
import { resolve, join } from 'path'
import { platform } from 'os'
import type { PanelSegmentationResult } from './types'
import { ClientPanelSegmentationService } from './client-panel-segmentation'

export class PanelSegmentationService {
  private pythonScriptPath: string
  private isWindows: boolean
  private condaPath: string
  private condaEnvPath: string
  private clientService: ClientPanelSegmentationService | null = null

  constructor() {
    // Don't instantiate clientService in constructor to avoid SSR issues
    this.isWindows = platform() === 'win32'
    
    // Use relative path that works on both platforms
    this.pythonScriptPath = join(process.cwd(), 'src/lib/panel_segmentation.py')
    
    // Set up conda environment paths based on platform
    if (this.isWindows) {
      // Common Windows conda paths
      this.condaPath = 'conda' // Use conda from PATH
      this.condaEnvPath = '' // Will use default environment
    } else {
      // macOS/Linux conda paths
      this.condaPath = '/opt/homebrew/Caskroom/miniconda/base/bin/conda'
      this.condaEnvPath = '/opt/homebrew/Caskroom/miniconda/base'
    }
    
    console.log(`🔍 Using Python script at: ${this.pythonScriptPath}`)
    console.log(`🐍 Platform: ${this.isWindows ? 'Windows' : 'Unix'}`)
    console.log(`📂 Current working directory: ${process.cwd()}`)
  }

  private getClientService(): ClientPanelSegmentationService {
    if (!this.clientService) {
      this.clientService = new ClientPanelSegmentationService()
    }
    return this.clientService
  }

  async segmentPanels(imageBase64: string): Promise<PanelSegmentationResult> {
    // Try client-side segmentation first (works on Vercel and in browser)
    const clientService = this.getClientService()
    if (clientService.isAvailable()) {
      try {
        console.log('🌐 Using client-side panel segmentation...')
        const result = await clientService.segmentPanels(imageBase64)
        console.log('✅ Client-side segmentation successful')
        return result
      } catch (error) {
        console.warn('⚠️ Client-side segmentation failed, falling back to Python:', error)
      }
    }

    // Fallback to Python-based segmentation (local development)
    return new Promise((resolve, reject) => {
      try {
        console.log('🐍 Starting Python panel segmentation...')
        // Remove data:image prefix if present
        const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '')
        
        console.log(`📁 Python script path: ${this.pythonScriptPath}`)
        console.log(`📊 Image data length: ${cleanBase64.length} characters`)
        
        // Use different execution strategies based on platform
         let pythonProcess
         
         if (this.isWindows) {
           // On Windows, use regular Python with stdin to avoid ENAMETOOLONG
           console.log('🐍 Using regular Python on Windows (stdin mode)')
           pythonProcess = spawn('python', [this.pythonScriptPath], {
             stdio: ['pipe', 'pipe', 'pipe']
           })
           
           // Write base64 data to stdin instead of command line argument
           pythonProcess.stdin.write(cleanBase64)
           pythonProcess.stdin.end()
         } else {
           // Unix/macOS: use conda with specified environment
           pythonProcess = spawn(this.condaPath, [
             'run', '-p', this.condaEnvPath, '--no-capture-output',
             'python', this.pythonScriptPath, cleanBase64
           ], {
             stdio: ['pipe', 'pipe', 'pipe']
           })
         }

        let stdout = ''
        let stderr = ''

        pythonProcess.stdout.on('data', (data) => {
          stdout += data.toString()
        })

        pythonProcess.stderr.on('data', (data) => {
          stderr += data.toString()
        })

        pythonProcess.on('close', (code) => {
          console.log(`🐍 Python process finished with code: ${code}`)
          if (stderr) {
            console.log(`🐍 Python stderr: ${stderr}`)
          }
          
          if (code !== 0) {
            console.error('Panel segmentation error:', stderr)
            reject(new Error(`Panel segmentation failed with code ${code}: ${stderr}`))
            return
          }

          try {
            console.log(`🐍 Python stdout (first 500 chars): ${stdout.substring(0, 500)}...`)
            const result = JSON.parse(stdout)
            if (result.error) {
              reject(new Error(result.error))
              return
            }
            console.log(`✅ Segmentation successful: ${result.panels?.length || 0} panels found`)
            resolve(result)
          } catch (error) {
            console.error('Failed to parse segmentation result:', stdout)
            reject(new Error('Failed to parse panel segmentation result'))
          }
        })

        pythonProcess.on('error', (error) => {
          reject(new Error(`Failed to start panel segmentation: ${error.message}`))
        })

      } catch (error) {
        reject(error)
      }
    })
  }

  async checkPythonDependencies(): Promise<boolean> {
    // If client-side segmentation is available, consider dependencies as "installed"
    const clientService = this.getClientService()
    if (clientService.isAvailable()) {
      console.log('✅ Client-side panel segmentation available')
      return true
    }

    // Check Python dependencies for fallback
    return new Promise((resolve) => {
      let pythonProcess
      
      try {
        // On Windows, use regular Python directly
        pythonProcess = spawn('python', ['-c', 'import numpy, cv2, PIL, skimage; print("OK")'], {
          stdio: ['pipe', 'pipe', 'pipe']
        })
      } catch (error) {
        pythonProcess = spawn(this.condaPath, [
          'run', '-n', 'base',
          'python', '-c', 'import numpy, cv2, PIL, skimage; print("OK")'
        ], {
          stdio: ['pipe', 'pipe', 'pipe']
        })
      }
      
      let output = ''
      
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString()
      })
      
      pythonProcess.on('close', (code) => {
        resolve(code === 0 && output.includes('OK'))
      })
      
      pythonProcess.on('error', () => {
        resolve(false)
      })
    })
  }
}
