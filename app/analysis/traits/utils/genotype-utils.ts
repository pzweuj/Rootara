// 从后端API获取基因型数据
export const fetchGenotypeData = async (rsid: string, reportId: string) => {
  const API_BASE_URL = process.env.NEXT_PUBLIC_ROOTARA_BACKEND_URL || 'http://0.0.0.0:8000';
  const API_KEY = process.env.NEXT_PUBLIC_ROOTARA_BACKEND_API_KEY || "rootara_api_key_default_001";
  
  try {
    const response = await fetch(`${API_BASE_URL}/variant/rsid`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        rsid: [rsid],
        report_id: reportId
      })
    });
    
    const data = await response.json();
    
    // 检查是否成功获取数据
    if (data && data[rsid]) {
      const variantData = data[rsid];
      
      // 如果无法查询到位点信息
      if (variantData.ref === null || variantData.genotype === null) {
        return { reference: '--', user: '--' };
      }
      
      // 构建reference基因型（ref + ref）
      const reference = variantData.ref + variantData.ref;
      // 直接使用返回的genotype作为user基因型
      const user = variantData.genotype;
      
      return { reference, user };
    }
    
    // 如果找不到数据，返回'--'
    return { reference: '--', user: '--' };
  } catch (error) {
    console.error('Error fetching genotype data:', error);
    return { reference: '--', user: '--' };
  }
}
