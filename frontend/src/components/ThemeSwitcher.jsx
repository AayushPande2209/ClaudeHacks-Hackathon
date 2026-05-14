import React from 'react';
import { LIcon } from './ui/LIcon';

export function ThemeSwitcher({ activeThemeId, setTheme, themes }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--bg-border)',
      borderRadius: 'var(--radius-full)',
      padding: '7px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      zIndex: 1000,
      boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
    }}>
      <LIcon name="palette" size={12} color="var(--text-muted)" />
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        fontWeight: 500,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'var(--text-disabled)',
        userSelect: 'none',
      }}>
        theme
      </span>
      <div style={{ width: 1, height: 12, background: 'var(--bg-border)' }} />
      {Object.entries(themes).map(([id, theme]) => {
        const active = activeThemeId === id;
        return (
          <button
            key={id}
            title={theme.name}
            onClick={() => setTheme(id)}
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: theme.preview,
              border: active ? '2px solid var(--text-primary)' : '2px solid transparent',
              outline: active ? '1px solid var(--bg-border)' : 'none',
              outlineOffset: 2,
              cursor: 'pointer',
              padding: 0,
              transform: active ? 'scale(1.2)' : 'scale(1)',
              transition: 'transform 0.15s ease, border-color 0.15s ease',
              flexShrink: 0,
            }}
          />
        );
      })}
    </div>
  );
}
