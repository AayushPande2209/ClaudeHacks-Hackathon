import React from "react";
import { LIcon } from "./ui/LIcon";

const TABS = [
  { id: 'dashboard', label: 'Globe',     icon: 'globe' },
  { id: 'company',   label: 'Products',  icon: 'layers' },
  { id: 'events',    label: 'Signals',   icon: 'activity' },
  { id: 'scenarios', label: 'Scenarios', icon: 'git-branch' },
  { id: 'report',    label: 'Audit',     icon: 'scroll' },
];

export function AppHeader({ page, setPage, apiOk }) {
  return (
    <header
      className="header-area"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        borderBottom: '1px solid var(--bg-border)',
        background: 'var(--bg-surface)',
        position: 'relative',
      }}
    >
      {/* Amber top-line accent */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: 2,
        background: `linear-gradient(90deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 0%, transparent) 60%)`,
        pointerEvents: 'none',
      }} />

      {/* Brand */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 20px 0 20px',
        borderRight: '1px solid var(--bg-border)',
        minWidth: 140,
        flexShrink: 0,
      }}>
        <img
          src="/assets/espada-mark.svg"
          width="22"
          height="22"
          alt="espada"
          style={{ borderRadius: '50%', flexShrink: 0 }}
        />
        <span style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 400,
          fontSize: 18,
          letterSpacing: '-0.02em',
          color: 'var(--text-primary)',
        }}>
          espada
        </span>
      </div>

      {/* Nav tabs */}
      <nav style={{ display: 'flex', alignItems: 'stretch', flex: 1, padding: '0 8px' }}>
        {TABS.map(t => {
          const active = page === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setPage(t.id)}
              title={t.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '0 14px',
                background: 'none',
                border: 'none',
                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1,
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'color var(--motion-fast) ease, border-color var(--motion-fast) ease',
                whiteSpace: 'nowrap',
                letterSpacing: active ? '-0.01em' : '0',
              }}
            >
              <LIcon
                name={t.icon}
                size={13}
                color={active ? 'var(--accent)' : 'var(--text-muted)'}
              />
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* Status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        borderLeft: '1px solid var(--bg-border)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          fontWeight: 400,
          letterSpacing: '0.06em',
          color: apiOk ? 'var(--success)' : 'var(--danger)',
        }}>
          <span style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: apiOk ? 'var(--success)' : 'var(--danger)',
            boxShadow: apiOk ? '0 0 8px var(--success)' : 'none',
            flexShrink: 0,
          }} />
          {apiOk ? 'LIVE' : 'OFFLINE'}
        </div>
      </div>
    </header>
  );
}
