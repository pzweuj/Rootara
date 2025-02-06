import React from 'react';
import MetabolismParser from './Characters/MetabolismParser';

const CharacterAnalysis: React.FC = () => {
  // 模拟基因型数据
  const mockGenotypes = {
    'rs1229984': 'GG',
    'rs671': 'AA',
    'rs345678': 'CT'
  };

  return (
    <div>
      <h1>角色特征分析</h1>
      <MetabolismParser 
        genotypes={mockGenotypes}
        markdownPath="/lib/characteristics/01.酒精代谢.md"
      />
    </div>
  );
};

export default CharacterAnalysis;
