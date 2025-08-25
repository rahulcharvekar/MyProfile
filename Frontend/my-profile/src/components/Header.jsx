// Header.jsx
import React from 'react';

export default function Header({ isCollapsed, toggleCollapse }) {
  return (
    <header className="bg-blue-800 text-white flex items-center justify-between px-4 py-3 shadow z-40">
      {/* Left section: Hamburger + Title */}
      <div className="flex items-center">
        <button
          onClick={toggleCollapse}
          className="p-2 hover:bg-blue-700 rounded focus:outline-none"
          title={isCollapsed ? 'Expand Menu' : 'Collapse Menu'}
        >
          <div className="space-y-1">
            <div className="w-6 h-0.5 bg-white" />
            <div className="w-6 h-0.5 bg-white" />
            <div className="w-6 h-0.5 bg-white" />
          </div>
        </button>
        <span className="ml-4 text-lg font-semibold"> Welcome</span>
      </div>
    </header>
  );
}
