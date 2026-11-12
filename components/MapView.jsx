"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";

// Online = the app is in the foreground (active) AND it has checked in recently. The staleness
// window catches an app that was force-killed while foregrounded and never sent a background update.
const STALE_MS = 35 * 1000;

// Stable icon instances so the CSS pulse animation isn't restarted on every 1s refresh.
const onlineIcon = L.divIcon({
  className: "hz-icon",
  html: '<div class="hz-dot on"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -7],
});
const offlineIcon = L.divIcon({
  className: "hz-icon",
  html: '<div class="hz-dot off"></div>',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
  popupAnchor: [0, -6],
});

// Dazey (the native camera app, bundle com.bossing.nativecam) is rendered in purple so it's easy to
// tell apart from the tweak (green). Same online pulse / dim-offline treatment, just a purple hue.
const dazeyOnlineIcon = L.divIcon({
  className: "hz-icon",
  html: '<div class="hz-dot dazey on"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -7],
});
const dazeyOfflineIcon = L.divIcon({
  className: "hz-icon",
  html: '<div class="hz-dot dazey off"></div>',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
  popupAnchor: [0, -6],
});

// Instagram accounts (bundle com.burbn.instagram / com.burbn.barcelona, or a re-signed clone whose
// stashed original id still contains "instagram"/"burbn") are rendered in orange.
const instaOnlineIcon = L.divIcon({
  className: "hz-icon",
  html: '<div class="hz-dot insta on"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -7],
});
const instaOfflineIcon = L.divIcon({
  className: "hz-icon",
  html: '<div class="hz-dot insta off"></div>',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
  popupAnchor: [0, -6],
});

function isDazey(row) {
  return (row.app_bundle || "").toLowerCase().includes("nativecam");
}

function isInstagram(row) {
  const b = (row.app_bundle || "").toLowerCase();
  return b.includes("instagram") || b.includes("burbn");
}

function iconFor(row, online) {
  if (isDazey(row)) return online ? dazeyOnlineIcon : dazeyOfflineIcon;
  if (isInstagram(row)) return online ? instaOnlineIcon : instaOfflineIcon;
  return online ? onlineIcon : offlineIcon;
}

function isOnline(row) {
  if (!row.active || !row.last_seen) return false;
  return Date.now() - new Date(row.last_seen).getTime() < STALE_MS;
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
        className="dark-tiles"
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points} />
      {located.map((r) => {
        const online = isOnline(r);
        return (
          <Marker
            key={r.user_id}
            position={[r.latitude, r.longitude]}
            icon={iconFor(r, online)}
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
          </Marker>
        );
      })}
    </MapContainer>
  );
}
