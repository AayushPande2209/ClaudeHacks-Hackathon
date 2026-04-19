import React, { useState, useEffect } from "react";
import { Glass } from "../components/ui/Glass";
import { Btn } from "../components/ui/Btn";
import { Chip, StatusChip } from "../components/ui/Chip";
import { api } from "../lib/api";

export function EventsPage({ setPage, setTargetRec }) {
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

  return (
    <div style={{maxWidth:900, margin:'0 auto'}}>
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
      {events.length === 0
        ? <div className="body-sm">No events yet. Run the signal monitor poll.</div>
        : <Glass>
            <table style={{fontSize:13}}>
              <thead><tr style={{color:'var(--fg-3)'}}>
                <th style={{textAlign:'left',padding:'6px 12px'}}>Title</th>
                <th style={{textAlign:'left',padding:'6px 12px'}}>Source</th>
                <th style={{textAlign:'left',padding:'6px 12px'}}>HS Codes</th>
                <th style={{padding:'6px 12px'}}></th>
              </tr></thead>
              <tbody>{events.map((ev,i)=>(
                <tr key={i} style={{borderTop:'1px solid var(--border-1)'}}>
                  <td style={{padding:'8px 12px', maxWidth:340, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{ev.title}</td>
                  <td style={{padding:'8px 12px'}}><Chip bg="var(--grey-100)" fg="var(--fg-3)">{ev.source}</Chip></td>
                  <td style={{padding:'8px 12px', fontFamily:'var(--font-mono)', fontSize:12}}>{(ev.hs_codes||[]).slice(0,3).join(', ')}</td>
                  <td style={{padding:'8px 12px'}}><Btn small onClick={()=>analyze(ev)}>Analyze</Btn></td>
                </tr>
              ))}</tbody>
            </table>
          </Glass>
      }
    </div>
  );
}
