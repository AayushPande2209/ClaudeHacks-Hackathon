import React from "react";

export function Glass({ children, style, thick, dark, padding = 16, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: dark || thick ? 'var(--bg-elevated)' : 'var(--bg-surface)',
        border: '1px solid var(--bg-border)',
        borderRadius: 'var(--radius-3)',
        boxShadow: thick
          ? '0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.025)'
          : '0 1px 3px rgba(0,0,0,0.25)',
        padding,
        color: 'var(--text-primary)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
