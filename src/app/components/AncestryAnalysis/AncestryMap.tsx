import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import React, { useState } from "react";
import { geoCentroid } from "d3-geo";
import worldMap from "@react-simple-maps/world";
import { ZoomableGroup } from "react-simple-maps";

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
  const [hoveredRegion, setHoveredRegion] = useState<RegionData | null>(null);

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">祖源地图</h3>
      <div className="relative w-full h-[400px]">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 150,
            center: [105, 35]
          }}
        >
          <ZoomableGroup>
            <Geographies geography={worldMap}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="#EAEAEC"
                    stroke="#D6D6DA"
                    style={{
                      default: { outline: "none" },
                      hover: { fill: "#F5F5F5", outline: "none" },
                      pressed: { fill: "#E2E2E2", outline: "none" },
                    }}
                  />
                ))
              }
            </Geographies>
            {regions.map((region) => (
              <Marker
                key={region.id}
                coordinates={[region.coordinates.cx, region.coordinates.cy]}
                fill="#FF5733"
                stroke="#FFFFFF"
                strokeWidth={2}
                radius={region.coordinates.r}
                onMouseEnter={() => setHoveredRegion(region)}
                onMouseLeave={() => setHoveredRegion(null)}
              />
            ))}
          </ZoomableGroup>
        </ComposableMap>

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
    </div>
  );
};

export default AncestryMap;