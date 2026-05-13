import React from "react";

export function Glass({ children, style, thick, dark, padding = 24, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: dark || thick ? 'var(--bg-elevated)' : 'var(--bg-surface)',
      border: '1px solid var(--bg-border)',
      borderRadius: 'var(--radius-3)',
      boxShadow: thick ? 'var(--shadow-glass-2)' : 'var(--shadow-glass-1)',
      padding,
      overflow: 'hidden',
      color: 'var(--fg-1)',
      ...style,
    }}>
      {children}
    </div>
  );
}
