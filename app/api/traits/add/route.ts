import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.ROOTARA_BACKEND_URL || 'http://0.0.0.0:8000';
const API_KEY = process.env.ROOTARA_BACKEND_API_KEY || "rootara_api_key_default_001";

export async function POST(request: NextRequest) {
  try {
    const { trait } = await request.json();
    
    if (!trait) {
      return NextResponse.json(
        { error: '缺少特征数据' },
        { status: 400 }
      );
    }

    const response = await fetch(`${API_BASE_URL}/traits/add?input_data=${encodeURIComponent(JSON.stringify(trait))}`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'x-api-key': API_KEY
      }
    });
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('创建特征失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}