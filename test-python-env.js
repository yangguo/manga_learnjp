const { spawn } = require('child_process')

async function testCondaEnvironment() {
  console.log('🧪 Testing conda environment directly...')
  
  return new Promise((resolve) => {
    const condaPath = '/opt/homebrew/Caskroom/miniconda/base/bin/conda'
    const condaEnvPath = '/opt/homebrew/Caskroom/miniconda/base'
    
    const pythonProcess = spawn(condaPath, [
      'run', '-p', condaEnvPath, '--no-capture-output',
      'python', '-c', 'import numpy, cv2, PIL; print("OK")'
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
      console.log(`✅ Process finished with code: ${code}`)
      console.log(`📤 stdout: ${stdout}`)
      if (stderr) console.log(`📤 stderr: ${stderr}`)
      resolve(code === 0 && stdout.trim() === 'OK')
    })

    pythonProcess.on('error', (error) => {
      console.error('❌ Process error:', error)
      resolve(false)
    })
  })
}

testCondaEnvironment().then(result => {
  console.log('🎯 Final result:', result ? 'SUCCESS' : 'FAILED')
})
