// Sidebar.jsx
import React from 'react';

export default function Sidebar({ currentPage, setCurrentPage, isCollapsed, setIsCollapsed }) {
  const pages = ["about", "dashboard", "contact", "chat"];

  const handleClick = (page) => {
    setCurrentPage(page);
    setIsCollapsed(true); // auto-collapse after click
  };

  return (
    <div
      className={`
        bg-gray-900 text-white w-48 border-r border-gray-800 p-2 flex flex-col items-center
        absolute top-0 left-0 bottom-0 z-30 transition-transform duration-300 ease-in-out
        ${isCollapsed ? '-translate-x-full' : 'translate-x-0'}
      `}
    >
      <ul className="mt-4 w-full space-y-2">
        {pages.map((page) => (
          <li
            key={page}
            className={`cursor-pointer rounded p-2 hover:bg-blue-200 ${currentPage === page ? 'bg-blue-300' : ''}`}
            onClick={() => handleClick(page)}
          >
            {page.charAt(0).toUpperCase() + page.slice(1)}
          </li>
        ))}
      </ul>
    </div>
  );
}
