import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import React, { useState } from "react";
import geoUrl from "./features.json";  // 需要创建这个文件

// 定义区域数据类型
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

const AncestryAnalysis: React.FC = () => {
  // 这里之后替换为实际的47个区域数据
  const [regions, setRegions] = useState<RegionData[]>([
    {
      id: "east-asia",
      name: "东亚",
      percentage: 80,
      coordinates: { cx: 750, cy: 200, r: 30 }
    },
    // ... 其他区域数据
  ]);

  const [hoveredRegion, setHoveredRegion] = useState<RegionData | null>(null);

  // 按百分比排序的区域数据
  const sortedRegions = [...regions].sort((a, b) => b.percentage - a.percentage);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold mb-4">祖源分析</h3>
        
        <div className="relative w-full h-[400px]">
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{
              scale: 150,
              center: [105, 35]
            }}
          >
            <Geographies geography="https://raw.githubusercontent.com/deldersveld/topojson/master/world-countries-no-antartica.json">
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="#EAEAEC"
                    stroke="#D6D6DA"
                    strokeWidth={0.5}
                    style={{
                      default: {
                        outline: 'none'
                      },
                      hover: {
                        fill: '#F5F5F5',
                        outline: 'none'
                      }
                    }}
                  />
                ))
              }
            </Geographies>
            
            {regions
              .filter(region => region.percentage > 0)
              .map(region => (
                <Marker
                  key={region.id}
                  coordinates={[region.coordinates.cx, region.coordinates.cy]}
                >
                  <circle
                    r={region.coordinates.r}
                    fill="none"
                    stroke="#4a90e2"
                    strokeWidth={2}
                    opacity={region.percentage / 100}
                    onMouseEnter={() => setHoveredRegion(region)}
                    onMouseLeave={() => setHoveredRegion(null)}
                    className="cursor-pointer transition-all duration-300"
                  />
                </Marker>
              ))}
          </ComposableMap>

          {/* 悬停提示框 */}
          {hoveredRegion && (
            <div
              className="absolute bg-black bg-opacity-75 text-white px-4 py-2 rounded-lg text-sm"
              style={{
                left: `${hoveredRegion.coordinates.cx}px`,
                top: `${hoveredRegion.coordinates.cy}px`,
                transform: 'translate(-50%, -100%)',
                pointerEvents: 'none'
              }}
            >
              {hoveredRegion.name}: {hoveredRegion.percentage}%
            </div>
          )}
        </div>

        {/* 区域列表 */}
        <div className="mt-6">
          {sortedRegions
            .filter(region => region.percentage > 0)
            .map(region => (
              <div
                key={region.id}
                className="flex justify-between items-center py-2 border-b last:border-b-0"
              >
                <span>{region.name}</span>
                <span>{region.percentage}%</span>
              </div>
            ))}
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold mb-4">Y染色体单倍群</h3>
        <p className="text-gray-600">Y染色体单倍群：O2a1</p>
        {/* 在这里插入图片 */}
        <img src="/path/to/y-chromosome-image.png" alt="Y染色体单倍群" className="mt-4" />
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold mb-4">MT线粒体单倍群</h3>
        <p className="text-gray-600">MT线粒体单倍群：D4</p>
        {/* 在这里插入图片 */}
        <img src="/path/to/mt-dna-image.png" alt="MT线粒体单倍群" className="mt-4" />
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold mb-4">尼安德特比例</h3>
        <p className="text-gray-600">尼安德特比例：2.1%</p>
        {/* 在这里插入图片 */}
        <img src="/path/to/neanderthal-image.png" alt="尼安德特比例" className="mt-4" />
      </div>
    </div>
  );
};

export default AncestryAnalysis;