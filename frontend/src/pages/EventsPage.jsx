import React, { useState, useEffect } from "react";
import { Glass } from "../components/ui/Glass";
import { Btn } from "../components/ui/Btn";
import { Chip, StatusChip } from "../components/ui/Chip";
import { api } from "../lib/api";

export function EventsPage({ setPage, setTargetRec, setActiveMapEvent, activeMapEvent }) {
  const [events, setEvents] = useState([]);
  const [boms, setBoms] = useState([]);

  useEffect(()=>{
    api('GET','/events').then(d=>setEvents(d.events||[])).catch(()=>{});
    api('GET','/boms').then(setBoms).catch(()=>{});
  }, []);

  async function analyze(ev) {
    if (!boms.length) { alert('Upload a BOM first (Company tab).'); return; }
    const r = await api('POST', `/events/${ev.id}/analyze`, { bom_id: boms[0].id });
    setTargetRec(r.recommendation_id);
    setPage('scenarios');
  }

  function toggleMapImpact(ev) {
    const isActive = activeMapEvent?.id === ev.id;
    setActiveMapEvent(isActive ? null : ev);
    if (!isActive) setPage('dashboard');
  }

  const threatColor = (level) => {
    if (level === 'CRITICAL') return '#D14343';
    if (level === 'HIGH') return '#D97757';
    if (level === 'MEDIUM') return '#C49A2B';
    return '#4F8F5A';
  };

  return (
    <div style={{maxWidth:960, margin:'0 auto'}}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div className="h4" style={{ margin: 0 }}>Tariff Events</div>
        {boms.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="body-sm" style={{ color: 'var(--fg-3)' }}>BOM to analyze:</span>
            <select
              style={{
                padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-1)',
                background: 'var(--grey-025)', fontSize: 13,
              }}
              onChange={(e) => {
                const b = boms.find(x => x.id === e.target.value);
                if (b) setBoms([b, ...boms.filter(x => x.id !== b.id)]);
              }}
            >
              {boms.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {activeMapEvent && (
        <div style={{
          marginBottom: 16, padding: '10px 16px', borderRadius: 10,
          background: 'rgba(209,67,67,0.07)', border: '1px solid rgba(209,67,67,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 13, color: '#D14343', fontWeight: 500 }}>
            🗺 Map filtered by: <strong>{activeMapEvent.title}</strong>
          </div>
          <Btn small variant="ghost" onClick={() => setActiveMapEvent(null)}>Clear Filter</Btn>
        </div>
      )}

      {events.length === 0
        ? <div className="body-sm">No events yet. Upload a BOM to auto-generate events, or run the signal monitor poll.</div>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {events.map((ev, i) => {
              const isActive = activeMapEvent?.id === ev.id;
              const threat = ev.threat_level || 'MEDIUM';
              const color = threatColor(threat);
              const countries = [...new Set([
                ...(ev.jurisdictions || []),
                ...(ev.affected_countries_hint || []),
              ])].slice(0, 4);

              return (
                <Glass
                  key={i}
                  padding={16}
                  style={{
                    borderLeft: isActive ? `3px solid ${color}` : '3px solid transparent',
                    transition: 'border-color 0.2s',
                    background: isActive ? `rgba(209,67,67,0.04)` : undefined,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    {/* Left: info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
                          padding: '2px 8px', borderRadius: 6,
                          background: `${color}18`, color,
                        }}>{threat}</span>
                        <Chip bg="var(--grey-100)" fg="var(--fg-3)">{ev.source}</Chip>
                        {isActive && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                            background: 'rgba(209,67,67,0.12)', color: '#D14343',
                            fontFamily: 'var(--font-mono)',
                          }}>MAP ACTIVE</span>
                        )}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 14, lineHeight: '20px', marginBottom: 4 }}>
                        {ev.title}
                      </div>
                      {ev.description && (
                        <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: '17px', marginBottom: 6,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {ev.description}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {(ev.hs_codes || []).length > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                            HS: {ev.hs_codes.slice(0, 3).join(', ')}
                          </span>
                        )}
                        {countries.length > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                            🌍 {countries.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: action buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                      <Btn small onClick={() => analyze(ev)}>Analyze</Btn>
                      <button
                        onClick={() => toggleMapImpact(ev)}
                        style={{
                          padding: '5px 12px', borderRadius: 8, border: `1px solid ${isActive ? color : 'var(--border-2)'}`,
                          background: isActive ? `${color}14` : 'transparent',
                          color: isActive ? color : 'var(--fg-2)',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          transition: 'all 0.15s', whiteSpace: 'nowrap',
                        }}
                      >
                        {isActive ? '✕ Unpin Map' : '🗺 Map Impact'}
                      </button>
                    </div>
                  </div>
                </Glass>
              );
            })}
          </div>
        )
      }
    </div>
  );
}
