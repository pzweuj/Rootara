"use client"

import L from "leaflet"
import { useEffect, useRef } from "react"
import "leaflet/dist/leaflet.css"

import { useLanguage } from "@/contexts/language-context"
import countries from "@/public/countries.geo.json"
import aliases from "@/public/K47_region_alias.json"

const regionCountries: Record<string, string[]> = aliases
const colors = [
  "#93c8e7",
  "#72b9e3",
  "#4aa6db",
  "#2e88c5",
  "#0868a6",
  "#034e7b",
]

export default function MapComponent({
  data,
}: {
  data: Record<string, number>
}) {
  const { language } = useLanguage()
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const mainRegion = useRef<L.LatLngBounds | null>(null)

  useEffect(() => {
    if (!container.current) {
      return
    }
    const instance = L.map(container.current, {
      center: [25, 0],
      zoom: 2,
      minZoom: 1,
      maxZoom: 6,
      zoomControl: false,
      attributionControl: false,
    })
    L.control.zoom({ position: "topright" }).addTo(instance)
    map.current = instance
    return () => {
      instance.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    if (!map.current) {
      return
    }
    const regions = Object.entries(data)
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
    const byCountry = new Map<string, [string, number]>()
    for (const [region, value] of regions) {
      for (const name of regionCountries[region] || []) {
        if (!byCountry.has(name)) {
          byCountry.set(name, [region, value])
        }
      }
    }
    const bounds = L.latLngBounds([])
    const layer = L.geoJSON(countries as GeoJSON.GeoJsonObject, {
      style: (feature) => {
        const value = byCountry.get(feature?.properties?.name)?.[1] || 0
        const band = [5, 10, 20, 40, 80].filter(
          (threshold) => value > threshold
        ).length
        return {
          fillColor: value ? colors[band] : "#e5e7eb",
          fillOpacity: 1,
          color: "#fff",
          weight: 0.8,
        }
      },
      onEachFeature: (feature, polygon) => {
        const name = feature.properties?.name || ""
        const match = byCountry.get(name)
        const label = document.createElement("span")
        label.textContent = match
          ? `${name} · ${match[0].replace(/-/g, " ")} · ${match[1].toFixed(2)}%`
          : name
        polygon.bindTooltip(label)
        if (
          match &&
          match[0] === regions[0]?.[0] &&
          polygon instanceof L.Polygon
        ) {
          bounds.extend(polygon.getBounds())
        }
      },
    }).addTo(map.current)
    mainRegion.current = bounds.isValid() ? bounds : null
    if (bounds.isValid()) {
      map.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 5 })
    }
    return () => {
      layer.remove()
    }
  }, [data])

  const reset = () => {
    if (mainRegion.current) {
      map.current?.fitBounds(mainRegion.current, {
        padding: [30, 30],
        maxZoom: 5,
      })
    } else {
      map.current?.setView([25, 0], 2)
    }
  }
  return (
    <div className="relative isolate">
      <div
        ref={container}
        className="h-[400px] w-full overflow-hidden rounded-lg border !bg-sky-100"
      />
      <button
        type="button"
        onClick={reset}
        className="absolute bottom-3 right-3 z-[500] rounded bg-background px-3 py-1 text-sm shadow"
      >
        {language === "en" ? "Reset view" : "复位地图"}
      </button>
    </div>
  )
}
