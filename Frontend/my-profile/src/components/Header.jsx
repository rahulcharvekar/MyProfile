// Header.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Header({ items = [] }) {
  return (
    <header className="bg-blue-800 text-white px-4 py-3 shadow z-40 font-sans">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <NavLink to="/welcome" className="text-base sm:text-lg font-semibold tracking-tight hover:underline cursor-pointer">
          Home
        </NavLink>
        {items.length > 0 && (
          <nav className="flex items-center gap-2 sm:gap-4">
            {items.map(({ key, label, path = `/${key}` }) => (
              <NavLink
                key={key}
                to={path}
                className={({ isActive }) => `px-2 py-1 rounded hover:bg-blue-700 text-sm sm:text-base ${isActive ? 'bg-blue-700' : ''}`}
              >
                {label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
