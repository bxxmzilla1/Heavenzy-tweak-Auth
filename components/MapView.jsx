"use client";

import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";

const ONLINE_MS = 2 * 60 * 1000; // "online" if seen in the last 2 minutes

function isOnline(row) {
  if (!row.last_seen) return false;
  return Date.now() - new Date(row.last_seen).getTime() < ONLINE_MS;
}

function timeAgo(ts) {
  if (!ts) return "never";
  const s = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 5, { animate: false });
    } else {
      map.fitBounds(points, { padding: [60, 60], maxZoom: 8 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length]);
  return null;
}

export default function MapView({ rows }) {
  const located = rows.filter(
    (r) => typeof r.latitude === "number" && typeof r.longitude === "number" && (r.latitude || r.longitude)
  );
  const points = located.map((r) => [r.latitude, r.longitude]);

  return (
    <MapContainer center={[20, 0]} zoom={2} minZoom={2} worldCopyJump scrollWheelZoom>
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <FitBounds points={points} />
      {located.map((r) => {
        const online = isOnline(r);
        const color = online ? "#35c759" : "#8a8a93";
        return (
          <CircleMarker
            key={r.user_id}
            center={[r.latitude, r.longitude]}
            radius={9}
            pathOptions={{ color: "#000", weight: 1, fillColor: color, fillOpacity: 0.9 }}
          >
            <Popup>
              <div className="popup" style={{ minWidth: 190 }}>
                <div style={{ marginBottom: 6 }}>
                  <span className={`pill ${online ? "on" : "off"}`}>{online ? "ONLINE" : "OFFLINE"}</span>
                </div>
                <b>{r.email || r.user_id}</b>
                <div style={{ fontSize: 12, color: "#333", marginTop: 6, lineHeight: 1.5 }}>
                  {(r.city || r.country) && (
                    <div>
                      {[r.city, r.country].filter(Boolean).join(", ")}
                    </div>
                  )}
                  {r.app_bundle && <div>App: {r.app_bundle}</div>}
                  {r.device_name && <div>Device: {r.device_name}</div>}
                  {r.ip && <div>IP: {r.ip}</div>}
                  <div>Source: {r.source === "gps" ? "GPS" : "IP"}</div>
                  <div>Last seen: {timeAgo(r.last_seen)}</div>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
