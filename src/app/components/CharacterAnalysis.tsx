import React from 'react';
import Characteristics from './Characters/Characteristics';
import fs from 'fs/promises';
import path from 'path';

interface CharacteristicFile {
  id: string;
  content: string;
}

interface GenotypeData {
  rsid: string;
  genotype: string;
}

// 移动测试数据到这里
const TEST_GENOTYPES: GenotypeData[] = [
  { rsid: "rs1229984", genotype: "GA" },  // ADH1B - 中等代谢型
  { rsid: "rs671", genotype: "GG" }       // ALDH2 - 正常代谢型
];

async function getCharacteristics() {
  const characteristicsDir = path.join(process.cwd(), 'public/lib/characteristics');
  const files = await fs.readdir(characteristicsDir);
  const markdownFiles = files.filter(file => file.endsWith('.md'));
  
  return Promise.all(
    markdownFiles.map(async (filename) => {
      const filePath = path.join(characteristicsDir, filename);
      const content = await fs.readFile(filePath, 'utf8');
      
      return {
        id: filename.replace('.md', ''),
        content
      };
    })
  );
}

export default async function CharacterAnalysis() {
  const characteristics = await getCharacteristics();

  return (
    <div className="character-analysis">
      <h2 className="text-2xl font-bold mb-4">基因特征分析</h2>
      <div className="grid gap-4">
        {characteristics.map((characteristic) => (
          <div key={characteristic.id} className="bg-white rounded-lg shadow p-6">
            <Characteristics 
              content={characteristic.content} 
              genotypes={TEST_GENOTYPES}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
