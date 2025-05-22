import { NextRequest, NextResponse } from 'next/server';

// 使用服务器端环境变量（不带NEXT_PUBLIC前缀）
const API_BASE_URL = process.env.ROOTARA_BACKEND_URL || 'http://0.0.0.0:8000';
const API_KEY = process.env.ROOTARA_BACKEND_API_KEY || "rootara_api_key_default_001";

export async function POST(request: NextRequest) {
  try {
    // 从请求中获取参数
    const requestData = await request.json();
    const { report_id, sort_by, sort_order, search_term, filters, indel } = requestData;
    
    if (!report_id) {
      return NextResponse.json(
        { error: '缺少报告ID' },
        { status: 400 }
      );
    }

    // 调用后端API
    const response = await fetch(`${API_BASE_URL}/report/clinvar`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        report_id,
        sort_by: sort_by || "",
        sort_order: sort_order || "asc",
        search_term: search_term || "",
        filters: filters || {},
        indel: indel || false
      })
    });
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }
    
    // 获取并返回数据
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('获取ClinVar数据失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}