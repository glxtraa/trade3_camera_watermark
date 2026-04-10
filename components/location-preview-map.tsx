"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

interface LocationPreviewMapProps {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export function LocationPreviewMap({
  latitude,
  longitude,
  accuracy
}: LocationPreviewMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      if (!containerRef.current) {
        return;
      }

      const leaflet = await import("leaflet");
      if (cancelled || !containerRef.current) {
        return;
      }

      if (!mapRef.current) {
        const map = leaflet.map(containerRef.current, {
          zoomControl: true,
          attributionControl: true
        });

        leaflet
          .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          })
          .addTo(map);

        mapRef.current = map;
      }

      const map = mapRef.current;
      map.eachLayer((layer) => {
        if (!("getAttribution" in layer)) {
          map.removeLayer(layer);
        }
      });

      const point = leaflet.latLng(latitude, longitude);
      const marker = leaflet.marker(point).addTo(map);
      const circle = leaflet.circle(point, {
        radius: Math.max(accuracy, 20),
        color: "#b04a2f",
        weight: 2,
        fillColor: "#b04a2f",
        fillOpacity: 0.18
      }).addTo(map);

      map.fitBounds(circle.getBounds(), {
        padding: [18, 18]
      });

      return () => {
        map.removeLayer(marker);
        map.removeLayer(circle);
      };
    }

    let cleanup: (() => void) | undefined;
    void setup().then((result) => {
      if (typeof result === "function") {
        cleanup = result;
      }
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [latitude, longitude, accuracy]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="leaflet-map" />;
}
