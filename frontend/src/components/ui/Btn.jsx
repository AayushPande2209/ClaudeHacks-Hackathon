import React from "react";

export function Btn({ children, onClick, variant = 'primary', disabled = false, small = false, style = {} }) {
  const base = {
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
    fontSize: small ? 12 : 13,
    letterSpacing: small ? '0.01em' : '0',
    padding: small ? '5px 12px' : '8px 16px',
    border: 'none',
    borderRadius: 'var(--radius-2)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all var(--motion-fast) ease',
    lineHeight: 1.4,
    ...style,
  };
  const variants = {
    primary: {
      background: disabled ? 'var(--bg-border)' : 'var(--accent)',
      color: disabled ? 'var(--text-disabled)' : 'var(--accent-text)',
      boxShadow: disabled ? 'none' : '0 1px 6px var(--accent-25)',
      opacity: disabled ? 0.6 : 1,
    },
    danger: {
      background: 'transparent',
      color: 'var(--danger)',
      border: '1px solid var(--danger-25)',
    },
    ghost: {
      background: 'var(--bg-elevated)',
      color: 'var(--text-secondary)',
      border: '1px solid var(--bg-border)',
    },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant] }}>
      {children}
    </button>
  );
}
