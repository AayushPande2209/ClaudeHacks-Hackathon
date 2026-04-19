import React, { useState, useEffect, useCallback } from "react";
import { Glass } from "../components/ui/Glass";
import { Btn } from "../components/ui/Btn";
import { Chip } from "../components/ui/Chip";
import { LIcon } from "../components/ui/LIcon";
import { D3WorldMap } from "../components/D3WorldMap";
import { api } from "../lib/api";

// ── Edit Row Modal ────────────────────────────────────────────────────────
function EditRowModal({ bom, row, onSave, onClose }) {
  const [form, setForm] = useState({
    sku_code: row.sku_code || '',
    description: row.description || '',
    supplier_name: row.supplier_name || '',
    supplier_country: row.supplier_country || '',
    unit_cost_usd: row.unit_cost_usd ?? '',
    annual_quantity: row.annual_quantity ?? '',
    hs_code: row.hs_code || '',
    tier: row.tier ?? 1,
    lead_time_weeks: row.lead_time_weeks ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const inp = { padding:'7px 10px', borderRadius:6, border:'1px solid var(--border-1)',
    background:'var(--grey-025)', fontSize:12, color:'var(--fg-1)',
    outline:'none', fontFamily:'var(--font-sans)', width:'100%', boxSizing:'border-box' };
  const lbl = { display:'block', marginBottom:4, fontWeight:500, color:'var(--fg-2)', fontSize:11 };

  async function save() {
    if (!form.supplier_country.trim()) { setErr('Supplier Country is required.'); return; }
    setSaving(true); setErr('');
    try {
      const updates = {};
      Object.entries(form).forEach(([k,v]) => { if (v !== '' && v !== null) updates[k] = v; });
      const r = await fetch(`/api/v1/boms/${bom.id}/rows/${row.id}`, {
        method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify(updates),
      });
      if (!r.ok) throw new Error(await r.text());
      onSave(await r.json());
    } catch(e) {
      setErr(e.message);
    } finally { setSaving(false); }
  }

  return (
    <div style={{position:'fixed',inset:0,zIndex:1100,background:'rgba(0,0,0,0.45)',
      display:'flex',alignItems:'center',justifyContent:'center',padding:24}} onClick={onClose}>
      <div style={{background:'#FFFFFF',borderRadius:14,width:'100%',maxWidth:520,
        boxShadow:'0 24px 80px rgba(0,0,0,0.2)',overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border-1)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>Edit Part</div>
            <div style={{fontSize:11,color:'var(--fg-3)',marginTop:1}}>{bom.name}</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:'var(--fg-3)'}}>✕</button>
        </div>
        <div style={{padding:'16px 20px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          {[
            {k:'sku_code',label:'SKU Code'},
            {k:'supplier_country',label:'Supplier Country *'},
            {k:'description',label:'Description',full:true},
            {k:'supplier_name',label:'Supplier Name'},
            {k:'unit_cost_usd',label:'Unit Cost (USD)',type:'number'},
            {k:'annual_quantity',label:'Annual Quantity',type:'number'},
            {k:'hs_code',label:'HS Code'},
            {k:'lead_time_weeks',label:'Lead Time (weeks)',type:'number'},
          ].map(({k,label,type,full})=>(
            <div key={k} style={full ? {gridColumn:'1/-1'} : {}}>
              <label style={lbl}>{label}</label>
              <input type={type||'text'} value={form[k]}
                onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                style={inp}/>
            </div>
          ))}
          <div>
            <label style={lbl}>Supply Tier</label>
            <select value={form.tier} onChange={e=>setForm(f=>({...f,tier:Number(e.target.value)}))} style={inp}>
              <option value={1}>Tier 1 — Direct</option>
              <option value={2}>Tier 2</option>
              <option value={3}>Tier 3</option>
              <option value={4}>Tier 4 — Raw</option>
            </select>
          </div>
        </div>
        {err && <div style={{padding:'0 20px 8px',color:'#D14343',fontSize:12}}>{err}</div>}
        <div style={{padding:'12px 20px',borderTop:'1px solid var(--border-1)',background:'#F4F4F6',
          display:'flex',justifyContent:'flex-end',gap:8}}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Btn>
        </div>
      </div>
    </div>
  );
}

// ── Products Panel ─────────────────────────────────────────────────────────
function ProductsPanel({ boms, loadBoms, setPage }) {
  const [expanded, setExpanded]   = useState(null);
  const [editTarget, setEditTarget] = useState(null); // {bom, row}
  const [deleting, setDeleting]   = useState(null);
  const [localBoms, setLocalBoms] = useState(boms);

  // keep in sync when parent reloads
  React.useEffect(() => { setLocalBoms(boms); }, [boms]);

  async function deleteBom(e, bomId) {
    e.stopPropagation();
    if (!window.confirm('Delete this product and all its parts?')) return;
    setDeleting(bomId);
    try {
      await fetch(`/api/v1/boms/${bomId}`, { method: 'DELETE' });
      setLocalBoms(prev => prev.filter(b => b.id !== bomId));
      if (expanded === bomId) setExpanded(null);
      if (loadBoms) loadBoms();
    } finally { setDeleting(null); }
  }

  function handleRowSaved(bomId, updatedRow) {
    setLocalBoms(prev => prev.map(b => b.id !== bomId ? b : {
      ...b, rows: (b.rows||[]).map(r => r.id === updatedRow.id ? updatedRow : r)
    }));
    setEditTarget(null);
  }

  return (
    <div className="left-area" style={{display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,flexShrink:0}}>
        <div className="eyebrow">Products <span style={{color:'var(--fg-3)',fontWeight:400}}>({localBoms.length})</span></div>
        <button onClick={()=>setPage('company')} style={{
          fontSize:11,padding:'4px 10px',borderRadius:8,border:'1px solid var(--accent)',
          background:'rgba(76,111,174,0.08)',color:'var(--accent)',cursor:'pointer',fontWeight:600,
        }}>+ Add</button>
      </div>

      {/* Scrollable list */}
      <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:8,
        paddingRight:2,scrollbarWidth:'thin',scrollbarColor:'var(--border-1) transparent'}}>
        {localBoms.length === 0 && (
          <Glass padding={20} style={{textAlign:'center'}}>
            <div style={{fontSize:12,color:'var(--fg-3)',marginBottom:10}}>No products yet.</div>
            <Btn small onClick={()=>setPage('company')}>+ Add Product</Btn>
          </Glass>
        )}
        {localBoms.map((b, i) => {
          const isOpen = expanded === b.id;
          const rows = b.rows || [];
          return (
            <Glass key={b.id} padding={12} style={{cursor:'pointer',flexShrink:0}}
              onClick={() => setExpanded(isOpen ? null : b.id)}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:34,height:34,borderRadius:8,background:'rgba(76,111,174,0.1)',
                  display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <LIcon name="box" size={16} color="#4C6FAE"/>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.name||`Product ${i+1}`}</div>
                  <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--fg-3)',marginTop:1}}>
                    {rows.length} SKU{rows.length!==1?'s':''} · Live
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:4}} onClick={e=>e.stopPropagation()}>
                  <button onClick={e=>deleteBom(e,b.id)} disabled={deleting===b.id}
                    title="Delete product"
                    style={{background:'none',border:'none',cursor:'pointer',color:'var(--fg-3)',
                      fontSize:13,padding:'4px',borderRadius:4,lineHeight:1,
                      opacity: deleting===b.id ? 0.4 : 1}}>🗑</button>
                </div>
                <LIcon name={isOpen?'chevron-up':'chevron-down'} size={13} color="var(--fg-3)"/>
              </div>

              {isOpen && (
                <div style={{marginTop:10,borderTop:'1px solid var(--border-1)',paddingTop:10}}
                  onClick={e=>e.stopPropagation()}>
                  {rows.length === 0 && (
                    <div style={{fontSize:11,color:'var(--fg-3)',textAlign:'center',padding:'8px 0'}}>No parts.</div>
                  )}
                  {rows.map((r, ri) => (
                    <div key={ri} style={{display:'flex',alignItems:'center',gap:6,
                      padding:'5px 0',fontSize:11,
                      borderBottom: ri<rows.length-1 ? '1px solid var(--border-1)' : 'none'}}>
                      <div style={{fontFamily:'var(--font-mono)',color:'var(--fg-3)',width:72,flexShrink:0,fontSize:10}}>{r.sku_code||'—'}</div>
                      <div style={{flex:1,color:'var(--fg-1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.description}</div>
                      <div style={{color:'var(--fg-3)',flexShrink:0,marginRight:4,fontSize:10}}>{r.supplier_country}</div>
                      <div style={{color:'var(--fg-2)',fontFamily:'var(--font-mono)',flexShrink:0,fontSize:10,marginRight:4}}>
                        {r.unit_cost_usd!=null?`$${Number(r.unit_cost_usd).toFixed(2)}`:'—'}
                      </div>
                      <button onClick={()=>setEditTarget({bom:b,row:r})}
                        title="Edit part"
                        style={{background:'none',border:'none',cursor:'pointer',color:'var(--accent)',
                          fontSize:11,padding:'2px 5px',borderRadius:4,flexShrink:0}}>✎</button>
                    </div>
                  ))}
                </div>
              )}
            </Glass>
          );
        })}
      </div>

      {editTarget && (
        <EditRowModal
          bom={editTarget.bom}
          row={editTarget.row}
          onSave={updated => handleRowSaved(editTarget.bom.id, updated)}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}

const RISK_META = {
  HIGH:   { bg: 'rgba(209,67,67,0.1)',   fg: '#D14343', bar: '#D14343' },
  MEDIUM: { bg: 'rgba(217,119,6,0.1)',   fg: '#D97706', bar: '#D97706' },
  LOW:    { bg: 'rgba(76,111,174,0.1)',  fg: '#4C6FAE', bar: '#4C6FAE' },
  INFO:   { bg: 'rgba(107,114,128,0.1)', fg: '#6B7280', bar: '#6B7280' },
};

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const COUNTRY_KEYWORDS = ['china','vietnam','india','mexico','canada','taiwan','south korea','indonesia','thailand','bangladesh','germany','france','italy'];

function matchBomParts(article, boms) {
  if (!boms?.length) return [];
  const articleText = ((article.title || '') + ' ' + (article.description || '') + ' ' + (article.affected_categories || []).join(' ')).toLowerCase();
  const cats = (article.affected_categories || []).map(c => c.toLowerCase());

  // Countries mentioned in the article
  const mentionedCountries = COUNTRY_KEYWORDS.filter(c => articleText.includes(c));

  const matched = [];
  for (const bom of boms) {
    for (const row of (bom.rows || [])) {
      const country = (row.supplier_country || '').toLowerCase();
      const desc = (row.description || '').toLowerCase();
      const sku = row.sku_code || '';
      const label = `${sku ? sku + ' · ' : ''}${row.description || ''}`.trim().slice(0, 52);

      // Country-level match (broadest — most reliable)
      if (mentionedCountries.some(c => country.includes(c))) {
        matched.push({ label, reason: row.supplier_country, priority: 0 });
        continue;
      }
      // Category-level match
      const catHit = cats.some(cat => {
        if (cat.includes('apparel') && /fabric|yarn|cotton|thread|garment|shirt|dye|textile/.test(desc)) return true;
        if (cat.includes('steel') && /steel|metal|aluminum|alloy/.test(desc)) return true;
        if (cat.includes('electronic') && /pcb|circuit|chip|battery|sensor|electronic|led/.test(desc)) return true;
        if (cat.includes('chemical') && /dye|resin|chemical|solvent/.test(desc)) return true;
        if (cat.includes('plastic') && /plastic|polymer|pvc|resin|bag|pouch/.test(desc)) return true;
        if (cat.includes('agricultural') && /bean|coffee|grain|cotton|fiber/.test(desc)) return true;
        if (cat.includes('machinery') && /pump|motor|valve|machine|press|drill/.test(desc)) return true;
        return false;
      });
      if (catHit) matched.push({ label, reason: 'category match', priority: 1 });
    }
  }

  // Dedupe, sort by priority
  const seen = new Set();
  return matched
    .sort((a, b) => a.priority - b.priority)
    .filter(m => { if (seen.has(m.label)) return false; seen.add(m.label); return true; })
    .slice(0, 5);
}

function NewsCard({ article, boms, forceShowImpact }) {
  const risk = RISK_META[article.risk_level] || RISK_META.INFO;
  const showImpact = forceShowImpact || article.risk_score > 50;
  const matchedParts = React.useMemo(() => showImpact ? matchBomParts(article, boms) : [], [showImpact, article, boms]);

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <Glass padding={14} style={{
          cursor: 'pointer', transition: 'box-shadow 0.15s',
          borderLeft: `3px solid ${risk.bar}`,
          background: forceShowImpact ? `${risk.bar}05` : undefined,
        }}
        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'}
        onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
          <Chip bg={risk.bg} fg={risk.fg}>{article.risk_level}</Chip>
          <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{article.source}</span>
          <span style={{ fontSize: 10, color: 'var(--fg-3)', marginLeft: 'auto' }}>{timeAgo(article.published_at)}</span>
        </div>

        <div style={{ fontWeight: 600, fontSize: 13, lineHeight: '18px', marginBottom: 5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {article.title}
        </div>

        <div style={{ fontSize: 11, color: 'var(--fg-2)', lineHeight: '16px',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {article.description}
        </div>

        {/* Risk score bar */}
        <div style={{ marginTop: 8, height: 3, borderRadius: 2, background: 'var(--border-1)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${article.risk_score}%`,
            background: risk.bar, borderRadius: 2, transition: 'width 0.6s ease' }} />
        </div>
        <div style={{ fontSize: 9, color: 'var(--fg-3)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
          RISK SCORE {article.risk_score}/100
        </div>

        {/* Impact section */}
        {showImpact && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${risk.bar}30` }}>
            {article.risk_why && (
              <div style={{ fontSize: 11, color: risk.bar, marginBottom: 8, lineHeight: '15px', fontWeight: 500 }}>
                ⚠ {article.risk_why}
              </div>
            )}

            {/* WHAT PARTS ARE AFFECTED — always shown prominently in High Risk tab */}
            <div style={{ marginBottom: 4 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
                color: risk.bar, marginBottom: 6, letterSpacing: '0.06em',
              }}>
                WHAT PARTS ARE AFFECTED
              </div>
              {matchedParts.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {matchedParts.map((p, i) => (
                    <div key={i} style={{
                      fontSize: 11, padding: '5px 8px', borderRadius: 6,
                      background: `${risk.bar}10`, border: `1px solid ${risk.bar}20`,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{ color: risk.bar, fontWeight: 700, fontSize: 13 }}>▸</span>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--fg-1)' }}>{p.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>sourced from {p.reason}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--fg-3)', fontStyle: 'italic' }}>
                  No direct part matches — upload a BOM with supplier countries to see impact.
                </div>
              )}
            </div>

            {(article.affected_categories || []).length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 9, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>SECTORS</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {article.affected_categories.map(cat => (
                    <span key={cat} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99,
                      background: `${risk.bar}12`, color: risk.bar, fontWeight: 500 }}>
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Glass>
    </a>
  );
}

function GoodIdeaPanel({ boms }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [tab, setTab]           = useState('all'); // 'all' | 'high' | 'formal'

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = forceRefresh ? '/news?refresh=true' : '/news';
      const d = await api('GET', url);
      setArticles(d.articles || []);
      setLastRefresh(new Date());
    } catch (e) {
      setError('Could not load news feed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load(), 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(t);
  }, [load]);

  const filtered = tab === 'high'
    ? articles.filter(a => a.risk_level === 'HIGH')
    : tab === 'formal'
    ? articles.filter(a => a.risk_level === 'HIGH' || a.risk_level === 'MEDIUM')
    : articles;

  const highCount = articles.filter(a => a.risk_level === 'HIGH').length;

  return (
    <div className="right-area" style={{ display: 'flex', flexDirection: 'column', gap: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ paddingBottom: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="eyebrow">Good Idea</div>
            {highCount > 0 && (
              <span style={{ background: '#D14343', color: '#fff', borderRadius: 10,
                fontSize: 10, fontWeight: 700, padding: '1px 7px' }}>
                {highCount} HIGH
              </span>
            )}
          </div>
          <button
            onClick={() => load(true)}
            disabled={loading}
            style={{
              background: loading ? 'var(--border-1)' : 'var(--accent)',
              border: 'none', borderRadius: 8, cursor: loading ? 'default' : 'pointer',
              color: '#fff', fontSize: 11, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
              opacity: loading ? 0.6 : 1,
            }}
          >
            <LIcon name="refresh-cw" size={11} color="#fff"/>
            {loading ? 'Loading…' : 'Refresh Feed'}
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[['all','All'], ['high','High Risk'], ['formal','Formal']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: tab === key ? 'var(--accent)' : 'var(--border-1)',
              color: tab === key ? '#fff' : 'var(--fg-2)',
              fontWeight: tab === key ? 600 : 400,
            }}>{label}</button>
          ))}
        </div>

        {lastRefresh && (
          <div style={{ fontSize: 9, color: 'var(--fg-3)', marginTop: 5, fontFamily: 'var(--font-mono)' }}>
            Updated {lastRefresh.toLocaleTimeString()} · Trade & tariff intelligence
          </div>
        )}
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8,
        paddingRight: 2,
        scrollbarWidth: 'thin', scrollbarColor: 'var(--border-1) transparent' }}>
        {error && (
          <Glass padding={16} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#D14343' }}>{error}</div>
            <Btn small variant="ghost" onClick={() => load(true)} style={{ marginTop: 8 }}>Retry</Btn>
          </Glass>
        )}
        {!error && loading && articles.length === 0 && (
          <Glass padding={16} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Fetching trade intelligence…</div>
          </Glass>
        )}
        {!error && !loading && filtered.length === 0 && (
          <Glass padding={16} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>No articles in this filter.</div>
          </Glass>
        )}
        {filtered.map(article => (
          <NewsCard key={article.id} article={article} boms={boms} forceShowImpact={tab === 'high'} />
        ))}
      </div>
    </div>
  );
}

export function DashboardPage({ boms, events, activeMapEvent, setActiveMapEvent, loadBoms, setPage }) {
  return (
    <>
      <ProductsPanel boms={boms} loadBoms={loadBoms} setPage={setPage} />
      <div className="center-area">
        <D3WorldMap events={events} boms={boms} activeMapEvent={activeMapEvent} />
        <div style={{position:'absolute', top:30, left:40, pointerEvents:'none'}}>
          <div className="h4" style={{letterSpacing:'-0.02em'}}>Global Supply Matrix</div>
          <div style={{marginTop:8, display:'flex', flexDirection:'column', gap:6}}>
            <div className="body-sm" style={{display:'flex', alignItems:'center', gap:8}}>
              <svg width="28" height="8" style={{flexShrink:0}}>
                <line x1="0" y1="4" x2="28" y2="4" stroke="var(--sev-critical)" strokeWidth="2" strokeDasharray="5,3"/>
              </svg>
              <span>High Risk Corridor</span>
            </div>
            <div className="body-sm" style={{display:'flex', alignItems:'center', gap:8}}>
              <svg width="28" height="8" style={{flexShrink:0}}>
                <line x1="0" y1="4" x2="28" y2="4" stroke="var(--domain-reshore)" strokeWidth="2" strokeDasharray="5,3"/>
              </svg>
              <span>Active Supplier</span>
            </div>
            <div className="body-sm" style={{display:'flex', alignItems:'center', gap:8}}>
              <span style={{width:10,height:10,borderRadius:5,background:'rgba(209,67,67,0.35)',flexShrink:0,display:'inline-block'}}/>
              <span>Tariff-Exposed Region</span>
            </div>
            <div className="body-sm" style={{display:'flex', alignItems:'center', gap:8}}>
              <span style={{width:10,height:10,borderRadius:5,background:'rgba(76,111,174,0.28)',flexShrink:0,display:'inline-block'}}/>
              <span>Supplier Region</span>
            </div>
          </div>
          <div className="body-sm" style={{marginTop:10, color:'var(--fg-3)', fontSize:10}}>
            Hover corridors for tariff details
          </div>
        </div>
      </div>
      <GoodIdeaPanel boms={boms} />
    </>
  );
}
