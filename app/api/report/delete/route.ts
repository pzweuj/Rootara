import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { report_id } = await request.json();
    
    const response = await fetch(`${process.env.ROOTARA_BACKEND_URL}/report/delete`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'x-api-key': process.env.ROOTARA_BACKEND_API_KEY || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ report_id })
    });

    if (!response.ok) {
      throw new Error('Failed to delete report on backend');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}