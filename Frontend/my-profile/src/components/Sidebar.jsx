// Sidebar.jsx
import React from "react";

export default function Sidebar({
  items,
  currentKey,
  setCurrentKey,
  isCollapsed,
  setIsCollapsed,
}) {
  const handleClick = (key) => {
    setCurrentKey(key);
    setIsCollapsed(true); // auto-collapse after click
  };

  return (
    <nav
      className={`
        bg-gray-900 text-white w-48 border-r border-gray-800 p-2 flex flex-col items-center
        absolute top-0 left-0 bottom-0 z-30 transition-transform duration-300 ease-in-out
        ${isCollapsed ? "-translate-x-full" : "translate-x-0"}
      `}
      aria-label="Sidebar"
    >
      <ul className="mt-4 w-full space-y-2">
        {items.map(({ key, label }) => (
          <li key={key}>
            <button
              type="button"
              onClick={() => handleClick(key)}
              className={`w-full text-left cursor-pointer rounded p-2 hover:bg-blue-200 focus:outline-none focus:ring
                ${currentKey === key ? "bg-blue-300" : ""}`}
              aria-current={currentKey === key ? "page" : undefined}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
