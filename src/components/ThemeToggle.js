import React from 'react';
import './ThemeToggle.css';

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-label={`Temayı ${isDark ? 'aydınlık' : 'koyu'} moda değiştir`}
    >
      <span className="theme-toggle__icon" aria-hidden="true">
        {isDark ? '🌙' : '☀️'}
      </span>
      <span className="theme-toggle__label">
        {isDark ? 'Koyu Mod' : 'Aydınlık Mod'}
      </span>
    </button>
  );
}

export default ThemeToggle;
