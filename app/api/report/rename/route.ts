import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { report_id, new_name, new_name_zh } = await request.json();
    
    const response = await fetch(`${process.env.ROOTARA_BACKEND_URL}/report/rename?report_id=${report_id}&new_name=${encodeURIComponent(new_name)}`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'x-api-key': process.env.ROOTARA_BACKEND_API_KEY || '',
        'Content-Type': 'application/json'
      },
      body: ""
    });

    if (!response.ok) {
      throw new Error('Failed to rename report on backend');
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