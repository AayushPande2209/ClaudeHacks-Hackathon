import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { feature } from 'topojson-client';

const CORRIDORS = [
  { country: 'China',   iso: 'CN',  lat: 35,   lng: 105,  rate: 145, note: '145% — Section 301 + reciprocal' },
  { country: 'India',   iso: 'IN',  lat: 20,   lng: 78,   rate: 50,  note: '50% — reciprocal'                },
  { country: 'Brazil',  iso: 'BR',  lat: -15,  lng: -47,  rate: 50,  note: '50% — reciprocal'                },
  { country: 'Vietnam', iso: 'VN',  lat: 16,   lng: 108,  rate: 46,  note: '46% — reciprocal'                },
  { country: 'EU',      iso: 'EU',  lat: 50,   lng: 10,   rate: 15,  note: '15% — reciprocal'                },
  { country: 'Mexico',  iso: 'MX',  lat: 23,   lng: -102, rate: 0,   note: '0% — USMCA exempt'              },
  { country: 'Canada',  iso: 'CA',  lat: 60,   lng: -95,  rate: 0,   note: '0% — USMCA exempt'              },
];

const US = { lat: 38, lng: -97 };

function riskColor(rate) {
  if (rate > 25) return '#ff4444';
  if (rate >= 10) return '#ff8800';
  return '#00cc44';
}

// Ocean-blue globe base — created once outside component to avoid GC churn
const GLOBE_MATERIAL = new THREE.MeshPhongMaterial({
  color:     new THREE.Color('#1a6b9a'),
  specular:  new THREE.Color('#0a2a4a'),
  shininess: 40,
});

export function Globe3D({ boms, activeMapEvent }) {
  const globeRef     = useRef();
  const containerRef = useRef();
  const resumeTimer  = useRef();

  const [dims, setDims]           = useState({ w: 500, h: 500 });
  const [globeReady, setGlobeReady] = useState(false);
  const [countries, setCountries] = useState([]);

  // Load world country polygons from world-atlas topojson
  useEffect(() => {
    fetch('https://unpkg.com/world-atlas@2/countries-110m.json')
      .then(r => r.json())
      .then(topo => {
        setCountries(feature(topo, topo.objects.countries).features);
      })
      .catch(() => {});
  }, []);

  // Responsive sizing via ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDims({ w: width, h: height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Enable auto-rotation once globe is mounted
  useEffect(() => {
    if (!globeReady || !globeRef.current) return;
    const ctrl = globeRef.current.controls();
    ctrl.autoRotate      = true;
    ctrl.autoRotateSpeed = 0.4;
    ctrl.enableDamping   = true;
  }, [globeReady]);

  // Pause rotation on interaction, resume after 3 s
  const pauseAndResume = useCallback(() => {
    if (!globeRef.current) return;
    globeRef.current.controls().autoRotate = false;
    clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      if (globeRef.current) globeRef.current.controls().autoRotate = true;
    }, 3000);
  }, []);

  // ISO-2 codes of countries actually in the user's BOM
  const bomCountries = useMemo(() => {
    const s = new Set();
    for (const bom of (boms || [])) {
      for (const row of (bom.rows || [])) {
        if (row.supplier_country) s.add(row.supplier_country.toUpperCase().slice(0, 2));
      }
    }
    return s;
  }, [boms]);

  // When an event is active, filter to only its affected corridors
  const corridors = useMemo(() => {
    if (!activeMapEvent) return CORRIDORS;
    const affected = new Set([
      ...(activeMapEvent.jurisdictions      || []).map(j => j.toUpperCase()),
      ...(activeMapEvent.affected_countries || []).map(c => c.toUpperCase()),
    ]);
    if (!affected.size) return CORRIDORS;
    return CORRIDORS.filter(c =>
      affected.has(c.iso) || affected.has(c.country.toUpperCase())
    );
  }, [activeMapEvent]);

  const arcsData = useMemo(() => corridors.map(c => ({
    startLat: c.lat,
    startLng: c.lng,
    endLat:   US.lat,
    endLng:   US.lng,
    color:    riskColor(c.rate),
    label:    `<div style="font:12px/1.5 'Inter',sans-serif;padding:6px 10px;background:rgba(5,10,20,0.92);border-radius:8px;border:1px solid rgba(255,255,255,0.12);color:#fff"><b>${c.country}</b><br/>${c.note}</div>`,
  })), [corridors]);

  const pointsData = useMemo(() => corridors.map(c => ({
    lat:   c.lat,
    lng:   c.lng,
    color: riskColor(c.rate),
    label: c.country,
    size:  bomCountries.has(c.iso) ? 0.7 : 0.4,
  })), [corridors, bomCountries]);

  const ringsData = useMemo(() => corridors
    .filter(c => bomCountries.has(c.iso))
    .map(c => ({
      lat:              c.lat,
      lng:              c.lng,
      maxR:             3,
      propagationSpeed: 3,
      repeatPeriod:     800,
      color:            riskColor(c.rate),
    })), [corridors, bomCountries]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
      onPointerDown={pauseAndResume}
      onWheel={pauseAndResume}
    >
      <Globe
        ref={globeRef}
        width={dims.w}
        height={dims.h}
        onGlobeReady={() => setGlobeReady(true)}

        // Ocean: custom blue material, no image texture
        globeImageUrl={null}
        globeMaterial={GLOBE_MATERIAL}
        backgroundColor="rgba(0,0,0,0)"
        atmosphereColor="rgba(80,160,255,0.25)"
        atmosphereAltitude={0.15}

        // Landmasses: green country polygons from world-atlas
        polygonsData={countries}
        polygonCapColor={() => '#2e7d3a'}
        polygonSideColor={() => '#1b5226'}
        polygonStrokeColor={() => '#52b06a'}
        polygonAltitude={0.006}

        // Trade corridors as animated arcs
        arcsData={arcsData}
        arcColor="color"
        arcLabel="label"
        arcDashLength={0.45}
        arcDashGap={0.25}
        arcDashAnimateTime={2200}
        arcStroke={0.6}
        arcAltitudeAutoScale={0.35}

        // Supplier / risk markers
        pointsData={pointsData}
        pointColor="color"
        pointRadius="size"
        pointAltitude={0.015}
        pointLabel="label"

        // Pulsing rings on BOM supplier countries
        ringsData={ringsData}
        ringColor={() => t => `rgba(255,255,255,${(1 - t) * 0.4})`}
        ringMaxRadius={3}
        ringPropagationSpeed={3}
        ringRepeatPeriod={800}
      />
    </div>
  );
}
