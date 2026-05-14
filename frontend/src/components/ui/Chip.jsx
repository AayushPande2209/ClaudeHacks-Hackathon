import React from "react";

export function Chip({ children, bg, fg }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      fontWeight: 500,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      padding: '3px 8px',
      borderRadius: 'var(--radius-1)',
      background: bg,
      color: fg,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      whiteSpace: 'nowrap',
      lineHeight: 1.4,
    }}>
      {children}
    </span>
  );
}

export function StatusChip({ status }) {
  const map = {
    running:           { bg: 'var(--success-10)',  fg: 'var(--success)', label: 'RUNNING' },
    complete:          { bg: 'var(--success-10)',  fg: 'var(--success)', label: 'COMPLETE' },
    awaiting_approval: { bg: 'var(--accent-dim)',  fg: 'var(--accent)',  label: 'PENDING REVIEW' },
    approved:          { bg: 'var(--success-10)',  fg: 'var(--success)', label: 'APPROVED' },
    edited:            { bg: 'var(--accent-dim)',  fg: 'var(--accent)',  label: 'EDITED' },
    rejected:          { bg: 'var(--danger-dim)',  fg: 'var(--danger)',  label: 'REJECTED' },
    error:             { bg: 'var(--danger-dim)',  fg: 'var(--danger)',  label: 'ERROR' },
  };
  const s = map[status] || { bg: 'var(--bg-elevated)', fg: 'var(--text-muted)', label: status?.toUpperCase() || '—' };
  return <Chip bg={s.bg} fg={s.fg}>{s.label}</Chip>;
}
