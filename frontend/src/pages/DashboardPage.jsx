import React, { useState, useEffect, useCallback } from "react";
import { Glass } from "../components/ui/Glass";
import { Btn } from "../components/ui/Btn";
import { Chip } from "../components/ui/Chip";
import { LIcon } from "../components/ui/LIcon";
import { D3WorldMap } from "../components/D3WorldMap";
import { api } from "../lib/api";

const DEMO_BOMS = [
  { id: 'p1', name: 'Single Origin Beans', rows: [
    { sku_code: 'GCB-ETH-001', description: 'Green Coffee Beans, Ethiopia Yirgacheffe (per lb)', supplier_country: 'Ethiopia', unit_cost_usd: 4.20 },
    { sku_code: 'GCB-COL-002', description: 'Green Coffee Beans, Colombia Huila (per lb)', supplier_country: 'Colombia', unit_cost_usd: 3.75 },
    { sku_code: 'GCB-VNM-003', description: 'Green Coffee Beans, Vietnam Robusta (per lb)', supplier_country: 'Vietnam', unit_cost_usd: 2.80 },
  ]},
  { id: 'p2', name: 'Retail Packaging Kit', rows: [
    { sku_code: 'PKG-BAG-001', description: '12oz Kraft Bag w/ One-Way Valve', supplier_country: 'China', unit_cost_usd: 0.52 },
    { sku_code: 'PKG-LBL-001', description: 'Printed Kraft Label (per unit)', supplier_country: 'China', unit_cost_usd: 0.09 },
    { sku_code: 'PKG-BOX-001', description: '6-Pack Retail Shipper Box', supplier_country: 'Mexico', unit_cost_usd: 0.38 },
  ]},
  { id: 'p3', name: 'Brew Accessories', rows: [
    { sku_code: 'FILT-PP-001', description: 'Paper Coffee Filter, #4 (per unit)', supplier_country: 'Vietnam', unit_cost_usd: 0.03 },
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

function NewsCard({ article }) {
  const risk = RISK_META[article.risk_level] || RISK_META.INFO;
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <Glass padding={14} style={{ cursor: 'pointer', transition: 'box-shadow 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'}
        onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
      >
        {/* Risk bar accent */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%',
          background: risk.bar, borderRadius: '8px 0 0 8px' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
          <Chip bg={risk.bg} fg={risk.fg}>{article.risk_level}</Chip>
          <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
            {article.source}
          </span>
          <span style={{ fontSize: 10, color: 'var(--fg-3)', marginLeft: 'auto' }}>
            {timeAgo(article.published_at)}
          </span>
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
      </Glass>
    </a>
  );
}

function GoodIdeaPanel() {
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
            style={{ background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer',
              color: 'var(--fg-3)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
          >
            <LIcon name="refresh-cw" size={12} color={loading ? 'var(--fg-3)' : 'var(--accent)'}/>
            {loading ? 'Loading…' : 'Refresh'}
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
          <NewsCard key={article.id} article={article} />
        ))}
      </div>
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
      <GoodIdeaPanel />
    </>
  );
}
