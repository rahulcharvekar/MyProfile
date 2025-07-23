// src/components/Sidebar.jsx
import React from 'react';

export default function Sidebar({ currentPage, setCurrentPage, isCollapsed, toggleCollapse }) {
  const pages = ["about", "dashboard",  "contact"];

  return (
    <div className={`bg-gray-900 text-white h-full border-r border-gray-800 text-white ${isCollapsed ? 'w-16' : 'w-48'} p-2 flex flex-col items-center`}>
      {/* Hamburger button */}
      <button class="bg-blue-700"
  onClick={toggleCollapse}
  className={`p-2 hover:bg-blue-100 rounded w-full flex items-center ${
    isCollapsed ? 'justify-center' : 'justify-start'
  }`}
  title={isCollapsed ? 'Expand Menu' : 'Collapse Menu'}
>
  {/* Hamburger icon: 3 horizontal lines */}
  <div className="space-y-1 mr-2">
    <div className="w-6 h-0.5 bg-white" />
    <div className="w-6 h-0.5 bg-white" />
    <div className="w-6 h-0.5 bg-white" />
  </div>

  {/* Show text only when expanded */}
  {!isCollapsed && <span className="text-white font-medium"> Menu</span>}
</button>

      {/* Menu list - hidden when collapsed */}
      {!isCollapsed && (
        <ul className="mt-4 w-full space-y-2">
          {pages.map((page) => (
            <li
              key={page}
              className={`cursor-pointer rounded p-2 hover:bg-blue-200 ${currentPage === page ? 'bg-blue-300' : ''}`}
              onClick={() => setCurrentPage(page)}
            >
              {page.charAt(0).toUpperCase() + page.slice(1)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
