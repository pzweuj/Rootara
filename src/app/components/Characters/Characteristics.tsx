'use client';

import React, { useEffect, useState } from 'react';
import { MDXRemote } from 'next-mdx-remote/rsc';

interface Characteristic {
  id: string;
  title: string;
  content: string;
}

interface GenotypeData {
  rsid: string;
  genotype: string;
}

interface CharacteristicFile {
  id: string;
  content: string;
}

interface CharacteristicsProps {
  content: string;
  genotypes: GenotypeData[];
}

const Characteristics: React.FC<CharacteristicsProps> = ({ content, genotypes }) => {
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([]);
  const [selectedCharacteristic, setSelectedCharacteristic] = useState<string | null>(null);

  useEffect(() => {
    const loadCharacteristics = async () => {
      try {
        const response = await fetch('/api/characteristics');
        const data = await response.json();
        
        const loadedCharacteristics = data.map((file: CharacteristicFile) => {
          let content = file.content;
          // 提取标题时增加容错处理
          const title = content.split('\n')[0]?.replace('#', '').trim() || '未命名特征';
          
          // 改进基因型替换，确保只替换检测位点部分的rsid
          content = content.replace(/### .+\n([\s\S]*?)(?=\n## |\n```|$)/g, (section) => {
            return section.replace(/rs\d+/g, (rsid: string) => {
              const genotypeData = genotypes.find(g => g.rsid === rsid);
              return genotypeData ? `${rsid} (${genotypeData.genotype})` : rsid;
            });
          });

          return {
            id: file.id,
            title,
            content
          };
        });

        setCharacteristics(loadedCharacteristics);
        if (loadedCharacteristics.length > 0) {
          setSelectedCharacteristic(loadedCharacteristics[0].id);
        }
      } catch (error) {
        console.error('Error loading characteristics:', error);
      }
    };

    if (genotypes.length > 0) {
      loadCharacteristics();
    }
  }, [genotypes]);

  const selectedContent = characteristics.find(c => c.id === selectedCharacteristic)?.content || '';

  return (
    <div className="characteristics-container">
      <div className="characteristics-sidebar">
        {characteristics.map(c => (
          <div
            key={c.id}
            className={`characteristic-item ${selectedCharacteristic === c.id ? 'active' : ''}`}
            onClick={() => setSelectedCharacteristic(c.id)}
          >
            {c.title}
          </div>
        ))}
      </div>
      <div className="characteristic-content">
        <MDXRemote source={selectedContent} />
      </div>
    </div>
  );
};

export default Characteristics;
