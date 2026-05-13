import React from "react";
import { LIcon } from "./ui/LIcon";

export function AppHeader({ page, setPage, apiOk }) {
  const tabs = [
    { id: 'dashboard', label: 'Global Map',        icon: 'radar' },
    { id: 'company',   label: 'Upload Materials',  icon: 'package' },
    { id: 'events',    label: 'Tariff Signals',    icon: 'zap' },
    { id: 'scenarios', label: 'HITL & Scenarios',  icon: 'shield-check' },
    { id: 'report',    label: 'Audit Log',         icon: 'file-clock' },
  ];

  return (
    <div className="header-area" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px',
      borderBottom: '1px solid var(--bg-border)',
      background: 'var(--bg-surface)',
      minHeight: 70,
    }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/assets/espada-mark.svg" width="36" height="36" alt="espada" style={{ borderRadius: '50%' }} />
        <span style={{
          fontWeight: 700, fontSize: 20, letterSpacing: '-.02em',
          fontFamily: 'var(--font-display)', color: 'var(--text-primary)',
        }}>espada</span>
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        {tabs.map(t => {
          const active = page === t.id;
          return (
            <button key={t.id} onClick={() => setPage(t.id)} title={t.label} style={{
              background: active ? 'var(--accent-dim)' : 'transparent',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 100,
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              color: active ? 'var(--accent)' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: 8,
              cursor: 'pointer',
              transition: 'all var(--motion-fast)',
            }}>
              <LIcon name={t.icon} size={15} color={active ? 'var(--accent)' : 'var(--text-muted)'} />
              <span style={{ display: active ? 'inline' : 'none' }}>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', borderRadius: 999,
          background: apiOk ? 'var(--success-10)' : 'var(--danger-dim)',
          color: apiOk ? 'var(--success)' : 'var(--danger)',
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, letterSpacing: '.06em',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: 999, display: 'inline-block',
            background: apiOk ? 'var(--success)' : 'var(--danger)',
            boxShadow: apiOk ? '0 0 6px var(--success)' : 'none',
          }} />
          {apiOk ? 'API LIVE' : 'API OFFLINE'}
        </div>
      </div>
    </div>
  );
}
