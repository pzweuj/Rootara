import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { input_data } = await request.json()
    
    const response = await fetch(
      `${process.env.ROOTARA_BACKEND_URL}/traits/import?input_data=${encodeURIComponent(input_data)}`,
      {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'x-api-key': process.env.ROOTARA_BACKEND_API_KEY || ''
        },
        body: ''
      }
    )
    
    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`)
    }
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in traits/import API:', error)
    return NextResponse.json(
      { error: 'Failed to import traits' },
      { status: 500 }
    )
  }
}