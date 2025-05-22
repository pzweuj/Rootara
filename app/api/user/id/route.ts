import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const response = await fetch(
      `${process.env.ROOTARA_BACKEND_URL}/user/id`,
      {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'x-api-key': process.env.ROOTARA_BACKEND_API_KEY || ''
        },
        body: JSON.stringify({})
      }
    );

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in user/id API:', error);
    return NextResponse.json(
      { error: 'Failed to get user ID' },
      { status: 500 }
    );
  }
}