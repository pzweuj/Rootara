'use client';

import React from 'react';
import worldSvg from './world.svg';
import Image from 'next/image';

interface RegionData {
  id: string;
  name: string;
  percentage: number;
  coordinates: {
    cx: number;
    cy: number;
    r: number;
  };
}

const AncestryMap: React.FC<{ regions: RegionData[] }> = ({ regions }) => {
  const [hoveredRegion, setHoveredRegion] = React.useState<RegionData | null>(null);

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">祖源地图</h3>
      <div className="relative w-full h-[400px]">
        <div className="absolute inset-0">
          <Image
            src={worldSvg}
            alt="World Map"
            fill
            className="object-contain"
            priority
          />
        </div>
        
        <svg
          viewBox="0 0 1000 500"
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: 'none' }}
        >
          {regions.map((region) => (
            <g key={region.id} style={{ pointerEvents: 'auto' }}>
              <circle
                cx={region.coordinates.cx * 1000 / 360 + 500}
                cy={250 - (region.coordinates.cy * 250 / 90)}
                r={Math.max(5, region.percentage * 0.5)}
                fill="#FF5733"
                stroke="#FFFFFF"
                strokeWidth="2"
                opacity="0.8"
                onMouseEnter={() => setHoveredRegion(region)}
                onMouseLeave={() => setHoveredRegion(null)}
                className="cursor-pointer transition-all duration-200 hover:opacity-100"
              />
            </g>
          ))}
        </svg>

        {hoveredRegion && (
          <div
            className="absolute bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm pointer-events-none"
            style={{
              left: `${(hoveredRegion.coordinates.cx * 1000 / 360 + 500) * 100 / 1000}%`,
              top: `${(250 - (hoveredRegion.coordinates.cy * 250 / 90)) * 100 / 500}%`,
              transform: 'translate(-50%, -100%)',
            }}
          >
            {hoveredRegion.name}: {hoveredRegion.percentage}%
          </div>
        )}
      </div>
    </div>
  );
};

export default AncestryMap;