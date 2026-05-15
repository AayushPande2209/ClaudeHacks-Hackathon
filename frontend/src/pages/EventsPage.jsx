import React, { useState, useEffect } from "react";
import { Glass } from "../components/ui/Glass";
import { Btn } from "../components/ui/Btn";
import { Chip, StatusChip } from "../components/ui/Chip";
import { api } from "../lib/api";

export function EventsPage({ events: eventsProp, setPage, setTargetRec, setActiveMapEvent, activeMapEvent }) {
  const [boms, setBoms] = useState([]);

  useEffect(()=>{
    api('GET','/boms').then(setBoms).catch(()=>{});
  }, []);

  const events = eventsProp || [];

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
    if (level === 'CRITICAL') return '#ef4444';
    if (level === 'HIGH') return '#f59e0b';
    if (level === 'MEDIUM') return '#f59e0b';
    return '#22c55e';
  };

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <span className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>Tariff Intelligence</span>
          <div className="h4">Signals</div>
        </div>
        {boms.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>BOM:</span>
            <select
              style={{
                padding: '6px 10px', borderRadius: 'var(--radius-2)',
                border: '1px solid var(--bg-border)',
                background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                fontSize: 12, fontFamily: 'var(--font-mono)',
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

      {/* Active map filter banner */}
      {activeMapEvent && (
        <div style={{
          marginBottom: 16, padding: '10px 14px',
          borderRadius: 'var(--radius-2)',
          background: 'var(--danger-dim)',
          border: '1px solid var(--danger-25)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 12, color: 'var(--danger)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
            MAP FILTER · <strong>{activeMapEvent.title}</strong>
          </div>
          <Btn small variant="ghost" onClick={() => setActiveMapEvent(null)}>Clear</Btn>
        </div>
      )}

      {events.length === 0 ? (
        <Glass padding={24}>
          <div className="body-sm">No events yet. Upload a BOM to auto-generate events.</div>
        </Glass>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                padding={14}
                style={{
                  borderLeft: `3px solid ${isActive ? color : 'var(--bg-border)'}`,
                  borderRadius: 'var(--radius-2)',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7, flexWrap: 'wrap' }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                        padding: '2px 7px', borderRadius: 'var(--radius-1)',
                        background: `${color}18`, color, border: `1px solid ${color}25`,
                      }}>{threat}</span>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 10,
                        color: 'var(--text-muted)', letterSpacing: '0.04em',
                      }}>{ev.source}</span>
                      {isActive && (
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
                          letterSpacing: '0.1em', padding: '2px 7px',
                          borderRadius: 'var(--radius-1)',
                          background: 'var(--danger-dim)', color: 'var(--danger)',
                        }}>PINNED</span>
                      )}
                    </div>
                    <div style={{
                      fontWeight: 600, fontSize: 13, lineHeight: 1.4,
                      marginBottom: 5, letterSpacing: '-0.01em',
                    }}>
                      {ev.title}
                    </div>
                    {ev.description && (
                      <div style={{
                        fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55,
                        marginBottom: 7,
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {ev.description}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                      {(ev.hs_codes || []).length > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          HS {ev.hs_codes.slice(0, 3).join(' · ')}
                        </span>
                      )}
                      {countries.length > 0 && (
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {countries.join(' · ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    <Btn small onClick={() => analyze(ev)}>Analyze</Btn>
                    <button
                      onClick={() => toggleMapImpact(ev)}
                      style={{
                        padding: '5px 11px',
                        borderRadius: 'var(--radius-2)',
                        border: `1px solid ${isActive ? color : 'var(--bg-border)'}`,
                        background: isActive ? `${color}12` : 'transparent',
                        color: isActive ? color : 'var(--text-muted)',
                        fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        transition: 'all 0.15s ease', whiteSpace: 'nowrap',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {isActive ? 'Unpin' : 'Map Impact'}
                    </button>
                  </div>
                </div>
              </Glass>
            );
          })}
        </div>
      )}
    </div>
  );
}
