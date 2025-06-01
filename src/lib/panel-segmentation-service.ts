import { spawn } from 'child_process'
import { resolve } from 'path'
import type { PanelSegmentationResult } from './types'

export class PanelSegmentationService {
  private pythonScriptPath: string

  constructor() {
    this.pythonScriptPath = resolve(__dirname, 'panel_segmentation.py')
  }

  async segmentPanels(imageBase64: string): Promise<PanelSegmentationResult> {
    return new Promise((resolve, reject) => {
      try {
        // Remove data:image prefix if present
        const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '')
        
        const pythonProcess = spawn('python3', [this.pythonScriptPath, cleanBase64], {
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
          if (code !== 0) {
            console.error('Panel segmentation error:', stderr)
            reject(new Error(`Panel segmentation failed with code ${code}: ${stderr}`))
            return
          }

          try {
            const result = JSON.parse(stdout)
            if (result.error) {
              reject(new Error(result.error))
              return
            }
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
      const pythonProcess = spawn('python3', ['-c', 'import numpy, cv2, PIL, skimage; print("OK")'], {
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
