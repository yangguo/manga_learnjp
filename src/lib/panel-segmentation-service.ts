import { spawn } from 'child_process'
import { resolve, join } from 'path'
import type { PanelSegmentationResult } from './types'

export class PanelSegmentationService {
  private pythonScriptPath: string
  private condaPath: string
  private condaEnvPath: string

  constructor() {
    // Use absolute path for development, relative for production
    const scriptPaths = [
      '/Users/vyang/Desktop/spaces/manga_learnjp/src/lib/panel_segmentation.py',
      join(process.cwd(), 'src/lib/panel_segmentation.py'),
      './src/lib/panel_segmentation.py'
    ]
    
    // Use the first path that exists
    this.pythonScriptPath = scriptPaths[0] // Start with absolute path
    
    // Set up conda environment paths
    this.condaPath = '/opt/homebrew/Caskroom/miniconda/base/bin/conda'
    this.condaEnvPath = '/opt/homebrew/Caskroom/miniconda/base'
    
    console.log(`🔍 Using Python script at: ${this.pythonScriptPath}`)
    console.log(`🐍 Using conda at: ${this.condaPath}`)
    console.log(`📂 Current working directory: ${process.cwd()}`)
  }

  async segmentPanels(imageBase64: string): Promise<PanelSegmentationResult> {
    return new Promise((resolve, reject) => {
      try {
        console.log('🐍 Starting Python panel segmentation...')
        // Remove data:image prefix if present
        const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '')
        
        console.log(`📁 Python script path: ${this.pythonScriptPath}`)
        console.log(`📊 Image data length: ${cleanBase64.length} characters`)
        
        // Use conda to run Python with the correct environment
        const pythonProcess = spawn(this.condaPath, [
          'run', '-p', this.condaEnvPath, '--no-capture-output',
          'python', this.pythonScriptPath, cleanBase64
        ], {
          stdio: ['pipe', 'pipe', 'pipe']
        })

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
    return new Promise((resolve) => {
      const pythonProcess = spawn(this.condaPath, [
        'run', '-p', this.condaEnvPath, '--no-capture-output',
        'python', '-c', 'import numpy, cv2, PIL, skimage; print("OK")'
      ], {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let stdout = ''

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      pythonProcess.on('close', (code) => {
        resolve(code === 0 && stdout.trim() === 'OK')
      })

      pythonProcess.on('error', () => {
        resolve(false)
      })
    })
  }
}
