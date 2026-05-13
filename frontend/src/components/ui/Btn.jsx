import React from "react";

export function Btn({ children, onClick, variant = 'primary', disabled = false, small = false, style = {} }) {
  const base = {
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    borderRadius: 'var(--radius-2)',
    transition: 'all var(--motion-fast)',
    fontSize: small ? 12 : 14,
    padding: small ? '6px 12px' : '10px 18px',
    ...style,
  };
  const variants = {
    primary: {
      background: disabled ? 'var(--bg-border)' : 'var(--accent)',
      color: disabled ? 'var(--text-disabled)' : 'var(--accent-text)',
      boxShadow: disabled ? 'none' : '0 1px 8px var(--accent-25)',
    },
    danger: {
      background: 'transparent',
      color: 'var(--danger)',
      border: '1px solid var(--danger-10)',
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
