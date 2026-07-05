import { NextRequest, NextResponse } from 'next/server'
import { getSystemAwakeManager } from '@/lib/system-awake-server'

interface SystemAwakeRequest {
  action?: 'start' | 'stop'
}

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json(getSystemAwakeManager().status())
}

export async function POST(request: NextRequest) {
  const body: SystemAwakeRequest = await request.json().catch(() => ({}))
  const manager = getSystemAwakeManager()

  if (body.action === 'start') {
    return NextResponse.json(manager.start())
  }

  if (body.action === 'stop') {
    return NextResponse.json(manager.stop())
  }

  return NextResponse.json(
    { error: 'Unsupported system awake action' },
    { status: 400 }
  )
}
