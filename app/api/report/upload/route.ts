import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    const response = await fetch(
      `${process.env.ROOTARA_BACKEND_URL}/report/upload`,
      {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ROOTARA_BACKEND_API_KEY || ''
        },
        body: formData
      }
    );

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in report/upload API:', error);
    return NextResponse.json(
      { error: 'Failed to upload report' },
      { status: 500 }
    );
  }
}