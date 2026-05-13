import React from "react";

export function Chip({ children, bg, fg }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      fontWeight: 500,
      letterSpacing: '.06em',
      padding: '3px 10px',
      borderRadius: 999,
      background: bg,
      color: fg,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

export function StatusChip({ status }) {
  const map = {
    running:           { bg: 'rgba(34,197,94,0.1)',  fg: '#22c55e', label: 'RUNNING' },
    complete:          { bg: 'rgba(34,197,94,0.1)',  fg: '#22c55e', label: 'COMPLETE' },
    awaiting_approval: { bg: 'var(--accent-dim)',      fg: 'var(--accent)', label: 'AWAITING APPROVAL' },
    approved:          { bg: 'rgba(34,197,94,0.1)',  fg: '#22c55e', label: 'APPROVED' },
    edited:            { bg: 'var(--accent-dim)',      fg: 'var(--accent)', label: 'EDITED' },
    rejected:          { bg: '#2a1a1a',              fg: '#ef4444', label: 'REJECTED' },
    error:             { bg: '#2a1a1a',              fg: '#ef4444', label: 'ERROR' },
  };
  const s = map[status] || { bg: 'var(--bg-border)', fg: 'var(--fg-3)', label: status };
  return <Chip bg={s.bg} fg={s.fg}>{s.label}</Chip>;
}
