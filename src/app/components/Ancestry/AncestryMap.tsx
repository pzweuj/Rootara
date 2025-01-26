'use client';

import Image from 'next/image';
import { useState } from 'react';

interface AncestryData {
  [key: string]: number;
}

const data: AncestryData = require('/public/lib/ancestry/test_aim.json'); // 测试数据

// 地图来源
// https://mapsvg.com/maps/world

const AncestryMap = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">祖源地图</h3>
      <div className="relative w-full h-[400px] border border-gray-200 rounded-lg overflow-hidden">
        <div className="absolute inset-0">
          <Image
            priority
            src="/lib/ancestry/world.svg"
            alt="World Map"
            fill
            className="object-contain"
          />
        </div>
      </div>
      <div className="mt-6 relative">
        <h4 className="text-lg font-medium mb-3">祖源比例</h4>
        <div className="space-y-2 relative">
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none transition-opacity duration-300"
               style={{ opacity: isExpanded ? 0 : 1 }} />
          
          <div className="max-h-[200px] overflow-y-auto transition-all duration-300"
               style={{ maxHeight: isExpanded ? '500px' : '200px' }}>
            {Object.entries(data)
              .map(([region, value]) => ({
                region: region.replace(/-/g, ' '),
                percentage: value.toFixed(2),
                value
              }))
              .sort((a, b) => b.value - a.value)
              .map((item, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between py-1.5"
                >
                  <span className="text-gray-600">{item.region}</span>
                  <span className="font-medium">{item.percentage}%</span>
                </div>
              ))}
          </div>
        </div>
        <button 
          className="mt-3 text-blue-500 hover:text-blue-700 flex items-center gap-1 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <>
              <span>收起</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            </>
          ) : (
            <>
              <span>显示更多</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default AncestryMap;