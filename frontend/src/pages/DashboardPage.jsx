import React, { useState } from "react";
import { Glass } from "../components/ui/Glass";
import { Btn } from "../components/ui/Btn";
import { Chip } from "../components/ui/Chip";
import { LIcon } from "../components/ui/LIcon";
import { D3WorldMap } from "../components/D3WorldMap";

const DEMO_BOMS = [
  { id: 'p1', name: 'Precision Grinder', rows: [
    { sku_code: 'GRD-001', description: 'Burr grind motor', supplier_country: 'China', unit_cost_usd: 42 },
    { sku_code: 'GRD-002', description: 'Grind housing', supplier_country: 'Taiwan', unit_cost_usd: 18 },
  ]},
  { id: 'p2', name: 'Barista Shirts', rows: [
    { sku_code: 'SHT-001', description: 'Cotton blend shirt', supplier_country: 'Vietnam', unit_cost_usd: 9 },
  ]},
  { id: 'p3', name: 'House Blend', rows: [
    { sku_code: 'COF-001', description: 'Green coffee beans', supplier_country: 'Brazil', unit_cost_usd: 6 },
  ]},
];

function ProductsPanel({ boms }) {
  const [expanded, setExpanded] = useState(null);
  const displayBoms = boms.length > 0 ? boms : DEMO_BOMS;

  return (
    <div className="left-area" style={{display:'flex', flexDirection:'column', gap:12}}>
      <div className="eyebrow" style={{marginBottom:4, marginLeft:4}}>Products</div>
      {displayBoms.map((b, i) => {
        const isOpen = expanded === b.id;
        const rows = b.rows || [];
        return (
          <Glass key={b.id} padding={14} style={{cursor:'pointer'}}
            onClick={() => setExpanded(isOpen ? null : b.id)}>
            <div style={{display:'flex', alignItems:'center', gap:12}}>
              <div style={{width:36,height:36,borderRadius:8,background:'rgba(76,111,174,0.1)',
                display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <LIcon name="box" size={18} color="#4C6FAE"/>
              </div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontWeight:600, fontSize:14}}>{b.name || `Product ${i+1}`}</div>
                <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--fg-3)',marginTop:1}}>
                  {rows.length} SKU{rows.length !== 1 ? 's' : ''} · {boms.length > 0 ? 'Live' : 'Demo'}
                </div>
              </div>
              <LIcon name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} color="var(--fg-3)"/>
            </div>
            {isOpen && rows.length > 0 && (
              <div style={{marginTop:10, borderTop:'1px solid var(--border-1)', paddingTop:10}}>
                {rows.map((r, ri) => (
                  <div key={ri} style={{display:'flex', justifyContent:'space-between', alignItems:'center',
                    padding:'4px 0', fontSize:12,
                    borderBottom: ri < rows.length-1 ? '1px solid var(--border-1)' : 'none'}}>
                    <div style={{fontFamily:'var(--font-mono)', color:'var(--fg-2)', width:80, flexShrink:0}}>{r.sku_code}</div>
                    <div style={{flex:1, color:'var(--fg-1)', padding:'0 8px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{r.description}</div>
                    <div style={{color:'var(--fg-3)', marginRight:8, flexShrink:0}}>{r.supplier_country}</div>
                    <div style={{color:'var(--fg-2)', fontFamily:'var(--font-mono)', flexShrink:0}}>${Number(r.unit_cost_usd||0).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            )}
          </Glass>
        );
      })}
    </div>
  );
}

function EventsPanel({ events, activeMapEvent, setActiveMapEvent }) {
  const displayEvents = events.slice(0, 3);
  const activeId = activeMapEvent?.id ?? activeMapEvent?.event_id;

  return (
    <div className="right-area" style={{display:'flex', flexDirection:'column', gap:16}}>
      <div className="eyebrow" style={{marginBottom:4, marginLeft:4}}>Tariff Signals</div>
      {displayEvents.length === 0 ? (
        <Glass padding={20} style={{textAlign:'center'}}>
          <div className="body-sm">No active signals. Load Demo or poll Federal Register.</div>
        </Glass>
      ) : displayEvents.map(ev => {
        const evId = ev.id ?? ev.event_id;
        const isActive = activeId != null && evId === activeId;
        return (
        <Glass
          key={evId}
          padding={16}
          style={{
            borderLeft: isActive ? '3px solid var(--accent)' : undefined,
            boxShadow: isActive ? '0 0 0 1px rgba(76,111,174,0.2)' : undefined,
          }}
        >
          <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap'}}>
            <Chip bg='rgba(209,67,67,.1)' fg='#D14343'>{ev.threat_level || 'EVENT'}</Chip>
            <div className="eyebrow">{ev.source||'manual'}</div>
            {isActive && (
              <Chip bg="rgba(76,111,174,.12)" fg="#4C6FAE">Map focus</Chip>
            )}
          </div>
          <div style={{fontWeight:600,fontSize:14,marginBottom:6,lineHeight:'20px'}}>{ev.title}</div>
          <div style={{fontSize:12,color:'var(--fg-2)',marginBottom:12,display:'-webkit-box',
            WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
            {ev.description||ev.raw_excerpt}
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
            borderTop:'1px solid var(--border-1)',paddingTop:12}}>
            <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'#D14343'}}>
              {ev.rate_change_hint || 'Rate unknown'}
            </div>
            <Btn
              small
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMapEvent(isActive ? null : ev);
              }}
            >
              Map Impact
            </Btn>
          </div>
        </Glass>
        );
      })}
    </div>
  );
}

export function DashboardPage({ boms, events, activeMapEvent, setActiveMapEvent }) {
  return (
    <>
      <ProductsPanel boms={boms} />
      <div className="center-area">
        <D3WorldMap events={events} boms={boms} activeMapEvent={activeMapEvent} />
        <div style={{position:'absolute', top:30, left:40, pointerEvents:'none'}}>
          <div className="h4" style={{letterSpacing:'-0.02em'}}>Global Supply Matrix</div>
          <div className="body-sm" style={{marginTop:4, display:'flex', alignItems:'center', gap:8}}>
            <span style={{width:8,height:8,borderRadius:4,background:'var(--sev-critical)'}}/> High Risk Corridors
          </div>
        </div>
      </div>
      <EventsPanel
        events={events}
        activeMapEvent={activeMapEvent}
        setActiveMapEvent={setActiveMapEvent}
      />
    </>
  );
}
