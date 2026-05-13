import React from 'react';
import { LIcon } from './ui/LIcon';

export function ThemeSwitcher({ activeThemeId, setTheme, themes }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--bg-elevated)',
      border: '0.5px solid var(--bg-border)',
      borderRadius: 999,
      padding: '8px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      zIndex: 1000,
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      <LIcon name="palette" size={14} color="var(--text-muted)" />
      <span style={{ fontSize: 10, color: 'var(--text-disabled)', letterSpacing: '0.06em', userSelect: 'none' }}>
        theme
      </span>
      {Object.entries(themes).map(([id, theme]) => {
        const active = activeThemeId === id;
        return (
          <button
            key={id}
            title={theme.name}
            onClick={() => setTheme(id)}
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: theme.preview,
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              outline: active ? '2px solid white' : 'none',
              outlineOffset: active ? 2 : 0,
              transform: active ? 'scale(1.15)' : 'scale(1)',
              transition: 'outline 0.15s, transform 0.15s',
              flexShrink: 0,
            }}
          />
        );
      })}
    </div>
  );
}
