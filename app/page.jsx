"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

// Leaflet touches `window`, so the map must be client-only (no SSR).
const MapView = dynamic(() => import("../components/MapView"), { ssr: false });

const STALE_MS = 35 * 1000; // online = active app seen within this window

export default function Page() {
  const [authed, setAuthed] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState([]);
  const [view, setView] = useState("map");
  const [busyBan, setBusyBan] = useState(null);
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/presence", { cache: "no-store" });
    if (r.status === 401) {
      setAuthed(false);
      return;
    }
    const j = await r.json();
    if (j.ok) setRows(j.rows || []);
  }, []);

  // On first mount, probe whether an admin cookie is already valid.
  useEffect(() => {
    (async () => {
      const r = await fetch("/api/presence", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        if (j.ok) {
          setRows(j.rows || []);
          setAuthed(true);
        }
      }
    })();
  }, []);

  // Poll every 15s while authed.
  useEffect(() => {
    if (!authed) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    load();
    timerRef.current = setInterval(load, 1000);
    return () => clearInterval(timerRef.current);
  }, [authed, load]);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const j = await r.json();
      if (j.ok) {
        setCode("");
        setAuthed(true);
      } else {
        setErr(j.error || "Login failed");
      }
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    setAuthed(false);
    setRows([]);
  }

  async function toggleBan(row) {
    const ban = !row.banned;
    if (ban && !confirm(`Ban ${row.email || row.user_id}? They'll be locked back to the sign-in screen.`)) return;
    setBusyBan(row.user_id);
    try {
      const r = await fetch("/api/ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: row.user_id, ban }),
      });
      const j = await r.json();
      if (!j.ok) alert(j.error || "Failed");
      // Optimistic: reflect immediately, then the next poll confirms.
      setRows((prev) => prev.map((x) => (x.user_id === row.user_id ? { ...x, banned: ban } : x)));
      load();
    } finally {
      setBusyBan(null);
    }
  }

  if (!authed) {
    return (
      <div className="gate">
        <form className="gate-card" onSubmit={submit}>
          <h1 className="brand">
            Heaven<span>zy</span>
          </h1>
          <p className="gate-sub">Enter the admin code to view the map</p>
          <input
            className="field"
            type="password"
            placeholder="Admin code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
          />
          <button className="btn" type="submit" disabled={busy || !code}>
            {busy ? "Checking…" : "Unlock"}
          </button>
          <div className="err">{err}</div>
        </form>
      </div>
    );
  }

  const onlineCount = rows.filter(
    (r) => r.active && r.last_seen && Date.now() - new Date(r.last_seen).getTime() < STALE_MS
  ).length;

  return (
    <div className="app">
      <div className="topbar">
        <span className="brand">
          Heaven<span>zy</span>
        </span>
        <span className="count">
          <b>{onlineCount}</b> online · {rows.length} total
        </span>
        <span className="spacer" />
        <button className="ghost" onClick={() => setView(view === "map" ? "list" : "map")}>
          {view === "map" ? "List" : "Map"}
        </button>
        <button className="ghost" onClick={load}>
          Refresh
        </button>
        <button className="ghost" onClick={logout}>
          Lock
        </button>
      </div>
      {view === "map" ? (
        <div className="map-wrap">
          <MapView rows={rows} />
        </div>
      ) : (
        <ListView rows={rows} onToggleBan={toggleBan} busyBan={busyBan} />
      )}
    </div>
  );
}

function isOnlineRow(r) {
  return r.active && r.last_seen && Date.now() - new Date(r.last_seen).getTime() < STALE_MS;
}

function timeAgo(ts) {
  if (!ts) return "never";
  const s = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function ListView({ rows, onToggleBan, busyBan }) {
  if (!rows.length) {
    return <div className="list-empty">No accounts have checked in yet.</div>;
  }
  return (
    <div className="list-wrap">
      <table className="list">
        <thead>
          <tr>
            <th>Status</th>
            <th>Account</th>
            <th>Location</th>
            <th>App</th>
            <th>Last seen</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const online = isOnlineRow(r);
            return (
              <tr key={r.user_id} className={r.banned ? "banned-row" : ""}>
                <td>
                  {r.banned ? (
                    <span className="pill ban">BANNED</span>
                  ) : (
                    <span className={`pill ${online ? "on" : "off"}`}>{online ? "ONLINE" : "OFFLINE"}</span>
                  )}
                </td>
                <td>{r.email || r.user_id}</td>
                <td>{[r.city, r.country].filter(Boolean).join(", ") || "—"}</td>
                <td>{r.app_bundle || "—"}</td>
                <td>{timeAgo(r.last_seen)}</td>
                <td>
                  <button
                    className={`ban-btn ${r.banned ? "unban" : "ban"}`}
                    disabled={busyBan === r.user_id}
                    onClick={() => onToggleBan(r)}
                  >
                    {busyBan === r.user_id ? "…" : r.banned ? "Unban" : "Ban"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
