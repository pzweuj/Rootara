import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.ROOTARA_BACKEND_URL || 'http://0.0.0.0:8000';
const API_KEY = process.env.ROOTARA_BACKEND_API_KEY || "rootara_api_key_default_001";

export async function POST(request: NextRequest) {
  try {
    const { traitData } = await request.json();


    if (!traitData) {
      return NextResponse.json(
        { error: '缺少特征数据' },
        { status: 400 }
      );
    }

    // 转换格式适配后端
    if (traitData && traitData.name) {
      traitData.name = typeof traitData.name === 'object' 
        ? JSON.stringify(traitData.name)
        : String(traitData.name);
    }
    if (traitData && traitData.description) {
      traitData.description = typeof traitData.description === 'object' 
        ? JSON.stringify(traitData.description)
        : String(traitData.description);
    }
    if (traitData && traitData.scoreThresholds) {
      traitData.scoreThresholds = typeof traitData.scoreThresholds === 'object' 
        ? JSON.stringify(traitData.scoreThresholds)
        : String(traitData.scoreThresholds);
    }
    if (traitData && traitData.result) {
      traitData.result = typeof traitData.result === 'object' 
        ? JSON.stringify(traitData.result)
        : String(traitData.result);
    }
    // 处理reference字段,将包含逗号的元素拆分成多个元素
    if (traitData && traitData.reference) {
      if (Array.isArray(traitData.reference)) {
        traitData.reference = traitData.reference.reduce((acc: string[], item: string) => {
          // 如果元素包含逗号,则拆分成多个元素
          if (item.includes(',')) {
            return [...acc, ...item.split(',').map(s => s.trim())]
          }
          return [...acc, item]
        }, []);
      } else {
        // 如果不是数组则转换为字符串
        traitData.reference = String(traitData.reference);
      }
    }


    console.log('Received trait:', JSON.stringify(traitData, null, 2));

    const response = await fetch(`${API_BASE_URL}/traits/add`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(traitData)
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