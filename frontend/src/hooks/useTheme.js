import { useState, useEffect } from 'react';
import { THEMES } from '../themes';

const LS_KEY = 'espada-theme';

function applyTheme(theme) {
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });
}

export function useTheme() {
  const [activeThemeId, setActiveThemeId] = useState(() => {
    return localStorage.getItem(LS_KEY) || 'carbon-amber';
  });

  useEffect(() => {
    const theme = THEMES[activeThemeId] || THEMES['carbon-amber'];
    applyTheme(theme);
  }, [activeThemeId]);

  function setTheme(id) {
    if (!THEMES[id]) return;
    setActiveThemeId(id);
    localStorage.setItem(LS_KEY, id);
  }

  return {
    activeTheme: THEMES[activeThemeId] || THEMES['carbon-amber'],
    activeThemeId,
    setTheme,
    themes: THEMES,
  };
}
