"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { useLanguage } from "@/contexts/language-context"

interface AncestryData {
  [key: string]: number
}

interface MapComponentProps {
  data: AncestryData
}

const MapComponent = ({ data }: MapComponentProps) => {
  const { language } = useLanguage()
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [regionAlias, setRegionAlias] = useState<any>({})
  const [initialRender, setInitialRender] = useState(true)

  // 使用useMemo缓存地图配置
  const mapConfig = useMemo(
    () => ({
      center: [30, 0] as L.LatLngExpression,
      zoom: 2,
      minZoom: 2,
      maxZoom: 5,
      zoomControl: false,
      worldCopyJump: true,
      maxBounds: [
        [-90, -200],
        [90, 200],
      ] as L.LatLngBoundsExpression,
      attributionControl: false,
    }),
    []
  )

  // 使用useMemo缓存tileLayer配置
  const tileLayerConfig = useMemo(
    () => ({
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }),
    []
  )

  // 根据比例返回不同深度的颜色
  const getColor = (percentage: number): string => {
    return percentage > 80
      ? "#034E7B" // 最深蓝色
      : percentage > 60
        ? "#0868A6" // 深蓝色
        : percentage > 40
          ? "#2E88C5" // 中深蓝色
          : percentage > 20
            ? "#4AA6DB" // 中蓝色
            : percentage > 10
              ? "#72B9E3" // 中浅蓝色
              : percentage > 5
                ? "#93C8E7" // 浅蓝色
                : percentage > 0
                  ? "#7EBCE4" // 调整后的最低比例颜色
                  : "#F5F5F5" // 无数据区域颜色
  }

  // 使用useMemo缓存geoJSON样式
  const geoJSONStyle = useMemo(() => {
    const countryPercentages = new Map<string, number>()
    const countryToRegionMap = new Map<
      string,
      { region: string; percentage: number }
    >()

    Object.entries(data).forEach(([region, percentage]) => {
      if (percentage > 0 && regionAlias[region]) {
        regionAlias[region].forEach((country: string) => {
          const currentPercentage = countryPercentages.get(country) || 0
          countryPercentages.set(
            country,
            Math.max(currentPercentage, percentage)
          )

          const currentData = countryToRegionMap.get(country)
          if (!currentData || currentData.percentage < percentage) {
            countryToRegionMap.set(country, { region, percentage })
          }
        })
      }
    })

    return {
      style: (feature: any) => {
        const countryName = feature?.properties?.name
        const percentage = countryPercentages.get(countryName) || 0

        return {
          fillColor: percentage > 0 ? getColor(percentage) : "#F5F5F5",
          weight: 1,
          opacity: 1,
          color: "white",
          fillOpacity: percentage > 0 ? 0.7 : 0.3,
        }
      },
      onEachFeature: (feature: any, layer: any) => {
        const countryName = feature?.properties?.name
        const regionData = countryToRegionMap.get(countryName)

        if (regionData) {
          layer.bindTooltip(
            `
            <strong>${regionData.region.replace(/-/g, " ")}</strong><br/>
            ${language === "en" ? "Proportion" : "比例"}: ${regionData.percentage.toFixed(2)}%
          `,
            {
              permanent: false,
              direction: "auto",
              className: "leaflet-tooltip-custom",
            }
          )
        }
      },
    }
  }, [data, regionAlias, language])

  // 添加复位函数
  const resetMapView = () => {
    if (!mapRef.current) return

    // 找出最高比例的地区
    let maxPercentage = 0
    let maxRegion = ""
    Object.entries(data).forEach(([region, percentage]) => {
      if (percentage > maxPercentage) {
        maxPercentage = percentage
        maxRegion = region
      }
    })

    if (maxRegion && regionAlias[maxRegion]) {
      const targetCountries = regionAlias[maxRegion]
      const bounds: L.LatLngBounds[] = []

      mapRef.current.eachLayer((layer: any) => {
        if (layer.feature) {
          const countryName = layer.feature.properties?.name
          if (targetCountries.includes(countryName)) {
            bounds.push(layer.getBounds())
          }
        }
      })

      if (bounds.length > 0) {
        const totalBounds = L.latLngBounds(
          bounds[0].getSouthWest(),
          bounds[0].getNorthEast()
        )
        bounds.forEach((bound) => totalBounds.extend(bound))

        mapRef.current.fitBounds(totalBounds, {
          padding: [50, 50],
          maxZoom: 5,
        })
      }
    }
  }

  useEffect(() => {
    // 动态导入GeoJSON数据和区域别名数据
    const loadGeoJSON = async () => {
      try {
        // 导入地理数据和区域别名数据
        const [worldGeoJSON, regionAliasModule] = await Promise.all([
          import("@/public/countries.geo.json"),
          import("@/public/K47_region_alias.json"),
        ])

        // 设置区域别名数据
        setRegionAlias(regionAliasModule.default)

        if (mapContainerRef.current && !mapRef.current) {
          // 初始化地图
          mapRef.current = L.map(mapContainerRef.current, mapConfig)

          // 添加底图
          L.tileLayer(
            "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
            tileLayerConfig
          ).addTo(mapRef.current)

          // 添加 GeoJSON 图层
          const geoJSONLayer = L.geoJSON(
            worldGeoJSON.default as GeoJSON.GeoJsonObject,
            geoJSONStyle
          )
          geoJSONLayer.addTo(mapRef.current)

          // 添加控件
          const zoomControl = L.control.zoom({ position: "topright" })
          zoomControl.addTo(mapRef.current)

          const CustomResetControl = L.Control.extend({
            options: {
              position: "topright",
            },

            onAdd: function () {
              const div = L.DomUtil.create(
                "div",
                "leaflet-control-zoom leaflet-bar"
              )
              div.innerHTML = `
                <a class="leaflet-control-zoom-home" href="#" title="${language === "en" ? "Reset to main region" : "复位到主要区域"}"
                   style="font-size: 18px; line-height: 26px;">⌂</a>
              `

              L.DomEvent.on(div, "click", function (e) {
                L.DomEvent.preventDefault(e)
                resetMapView()
              })

              return div
            },
          })

          const resetControl = new CustomResetControl()
          resetControl.addTo(mapRef.current)

          // 初始定位
          mapRef.current.whenReady(() => {
            if (initialRender) {
              setTimeout(() => {
                resetMapView()
                setInitialRender(false)
              }, 300)
            }
          })
        }
      } catch (error) {
        console.error("加载地图数据失败:", error)
      }
    }

    loadGeoJSON()

    return () => {
      if (mapRef.current) {
        mapRef.current.eachLayer((layer) => {
          layer.remove()
        })
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [mapConfig, tileLayerConfig, geoJSONStyle, initialRender, language])

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-[400px] border border-gray-200 rounded-lg overflow-hidden"
    />
  )
}

export default MapComponent
