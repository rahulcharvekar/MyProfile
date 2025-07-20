// src/App.jsx
import { useState } from "react";
import { Menu, MenuItem } from "@mui/material";
import { ChevronLeft, Menu as MenuIcon, AccountCircle } from "@mui/icons-material";

export default function App() {
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleProfileClick = (event) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleClose = () => {
    setMenuAnchor(null);
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex justify-between items-center p-4 bg-blue-600 text-white">
        <div className="flex items-center gap-2">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            {isSidebarOpen ? <ChevronLeft /> : <MenuIcon />}
          </button>
          <span className="text-lg font-semibold">My React App</span>
        </div>
        <div className="relative cursor-pointer" onClick={handleProfileClick}>
          <AccountCircle className="text-3xl" />
        </div>
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleClose}>
          <MenuItem onClick={handleClose}>Profile</MenuItem>
          <MenuItem onClick={handleClose}>Settings</MenuItem>
          <MenuItem onClick={handleClose}>Logout</MenuItem>
        </Menu>
      </header>

      {/* Main Section */}
      <div className="flex flex-1">
        {/* Sidebar */}
        {isSidebarOpen && (
          <aside className="w-64 bg-gray-200 p-4">
            <ul className="space-y-2">
              <li className="font-bold">Home</li>
              <li>About</li>
              <li>Contact</li>
              <li>Dashboard</li>
            </ul>
          </aside>
        )}

        {/* Content Area */}
        <main className="flex-1 bg-white p-6 overflow-auto">
          <h1 className="text-2xl font-bold mb-4">Main Content Area</h1>
          <p>
            Welcome to the React app template with a profile menu, sliding sidebar, and structured layout.
          </p>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 text-white text-center py-2">
        &copy; 2025 My Website | Footer Content Here
      </footer>
    </div>
  );
}