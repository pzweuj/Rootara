import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { traits } = await request.json()
    
    const response = await fetch(
      `${process.env.ROOTARA_BACKEND_URL}/traits/export`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ROOTARA_BACKEND_API_KEY || ''
        },
        body: JSON.stringify(traits)
      }
    )
    
    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`)
    }
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in traits/export API:', error)
    return NextResponse.json(
      { error: 'Failed to export traits' },
      { status: 500 }
    )
  }
}