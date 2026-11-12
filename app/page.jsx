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
        <button className="ghost" onClick={load}>
          Refresh
        </button>
        <button className="ghost" onClick={logout}>
          Lock
        </button>
      </div>
      <div className="map-wrap">
        <MapView rows={rows} />
      </div>
    </div>
  );
}
