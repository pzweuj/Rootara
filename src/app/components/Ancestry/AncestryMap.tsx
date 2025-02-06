'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface AncestryData {
  [key: string]: number;
}

interface RegionAlias {
  [key: string]: string[];
}

interface AncestryMapProps {
  data: AncestryData;
}

// 导入地区别名数据
// import regionAliasData from '@/public/lib/ancestry/K47_region_alias.json';
import regionAliasData from '@/public/lib/ancestry/K12b_region_alias.json';

// 地区geojson来源：https://github.com/johan/world.geo.json/blob/master/countries.geo.json
import worldGeoJSON from '@/public/lib/ancestry/countries.geo.json';

const AncestryMap = ({ data }: AncestryMapProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [regionAlias] = useState<RegionAlias>(regionAliasData);
  const [initialRender, setInitialRender] = useState(true);

  // 使用useMemo缓存地图配置
  const mapConfig = useMemo(() => ({
    center: [30, 0] as L.LatLngExpression,
    zoom: 2,
    minZoom: 2,
    maxZoom: 5,
    zoomControl: false,
    worldCopyJump: true,
    maxBounds: [
      [-90, -200],
      [90, 200]
    ] as L.LatLngBoundsExpression,
    attributionControl: false
  }), []);

  // 使用useMemo缓存tileLayer配置
  const tileLayerConfig = useMemo(() => ({
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }), []);

  // 使用useMemo缓存geoJSON样式
  const geoJSONStyle = useMemo(() => {
    const countryPercentages = new Map<string, number>();
    const countryToRegionMap = new Map<string, { region: string; percentage: number }>();

    Object.entries(data).forEach(([region, percentage]) => {
      if (percentage > 0 && regionAlias[region]) {
        regionAlias[region].forEach(country => {
          const currentPercentage = countryPercentages.get(country) || 0;
          countryPercentages.set(country, Math.max(currentPercentage, percentage));

          const currentData = countryToRegionMap.get(country);
          if (!currentData || currentData.percentage < percentage) {
            countryToRegionMap.set(country, { region, percentage });
          }
        });
      }
    });

    return {
      style: (feature: any) => {
        const countryName = feature?.properties?.name;
        const percentage = countryPercentages.get(countryName) || 0;
        
        return {
          fillColor: percentage > 0 ? getColor(percentage) : '#F5F5F5',
          weight: 1,
          opacity: 1,
          color: 'white',
          fillOpacity: percentage > 0 ? 0.7 : 0.3
        };
      },
      onEachFeature: (feature: any, layer: any) => {
        const countryName = feature?.properties?.name;
        const regionData = countryToRegionMap.get(countryName);
        
        if (regionData) {
          layer.bindTooltip(`
            <strong>${regionData.region.replace(/-/g, ' ')}</strong><br/>
            比例: ${regionData.percentage.toFixed(2)}%
          `, {
            permanent: false,
            direction: 'auto',
            className: 'leaflet-tooltip-custom'
          });
        }
      }
    };
  }, [data, regionAlias]);

  // 添加复位函数
  const resetMapView = () => {
    if (!mapRef.current) return;

    // 找出最高比例的地区
    let maxPercentage = 0;
    let maxRegion = '';
    Object.entries(data).forEach(([region, percentage]) => {
      if (percentage > maxPercentage) {
        maxPercentage = percentage;
        maxRegion = region;
      }
    });

    if (maxRegion && regionAlias[maxRegion]) {
      const targetCountries = regionAlias[maxRegion];
      const bounds: L.LatLngBounds[] = [];
      
      mapRef.current.eachLayer((layer: any) => {
        if (layer.feature) {
          const countryName = layer.feature.properties?.name;
          if (targetCountries.includes(countryName)) {
            bounds.push(layer.getBounds());
          }
        }
      });

      if (bounds.length > 0) {
        const totalBounds = L.latLngBounds(bounds[0].getSouthWest(), bounds[0].getNorthEast());
        bounds.forEach(bound => totalBounds.extend(bound));
        
        mapRef.current.fitBounds(totalBounds, {
          padding: [50, 50],
          maxZoom: 5
        });
      }
    }
  };

  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      // 初始化地图
      mapRef.current = L.map(mapContainerRef.current, mapConfig);

      // 添加底图
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png', tileLayerConfig)
        .addTo(mapRef.current);

      // 添加 GeoJSON 图层
      const geoJSONLayer = L.geoJSON(worldGeoJSON as any, geoJSONStyle);
      geoJSONLayer.addTo(mapRef.current);

      // 添加控件
      const zoomControl = L.control.zoom({ position: 'topright' });
      zoomControl.addTo(mapRef.current);

      const CustomResetControl = L.Control.extend({
        options: {
          position: 'topright'
        },
        
        onAdd: function() {
          const div = L.DomUtil.create('div', 'leaflet-control-zoom leaflet-bar');
          div.innerHTML = `
            <a class="leaflet-control-zoom-home" href="#" title="复位到主要区域" 
               style="font-size: 18px; line-height: 26px;">⌂</a>
          `;
          
          L.DomEvent.on(div, 'click', function(e) {
            L.DomEvent.preventDefault(e);
            resetMapView();
          });
          
          return div;
        }
      });

      const resetControl = new CustomResetControl();
      resetControl.addTo(mapRef.current);

      // 初始定位
      mapRef.current.whenReady(() => {
        if (initialRender) {
          setTimeout(() => {
            resetMapView();
            setInitialRender(false);
          }, 300);
        }
      });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.eachLayer((layer) => {
          layer.remove();
        });
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapConfig, tileLayerConfig, geoJSONStyle, initialRender]);

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">祖源地图</h3>
      <div 
        ref={mapContainerRef}
        className="w-full h-[400px] border border-gray-200 rounded-lg overflow-hidden"
      />
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
                  className="flex items-center justify-between py-1.5 relative"
                >
                  <div className="absolute left-0 top-0 bottom-0"
                       style={{
                         backgroundColor: getColor(item.value),
                         width: `${item.value}%`,
                         maxWidth: '100%',
                         opacity: 0.7
                       }} />
                  <span className="relative z-10 text-gray-600">
                    {item.region}
                  </span>
                  <span className="font-medium relative z-10 text-gray-600">
                    {item.percentage}%
                  </span>
                </div>
              ))}
          </div>
        </div>
        <button 
          className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-4 text-sm text-gray-600 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 rounded-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-200"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="font-medium">
            {isExpanded ? '收起内容' : '显示更多内容'}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 transition-transform duration-300 ${
              isExpanded ? 'rotate-180' : ''
            }`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

// 根据比例返回不同深度的颜色
const getColor = (percentage: number): string => {
  // 使用更深更饱和的蓝色渐变，特别加深了最低比例的颜色
  return percentage > 80 ? '#034E7B' :   // 最深蓝色
         percentage > 60 ? '#0868A6' :   // 深蓝色
         percentage > 40 ? '#2E88C5' :   // 中深蓝色
         percentage > 20 ? '#4AA6DB' :   // 中蓝色
         percentage > 10 ? '#72B9E3' :   // 中浅蓝色
         percentage > 5  ? '#93C8E7' :   // 浅蓝色
         percentage > 0  ? '#7EBCE4' :   // 调整后的最低比例颜色
                          '#F5F5F5';     // 无数据区域颜色
};

export default AncestryMap;