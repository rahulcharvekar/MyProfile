import { Menu, MenuItem } from "@mui/material";
import { ChevronLeft, Menu as MenuIcon, AccountCircle } from "@mui/icons-material";

export default function Header({ isSidebarOpen, setIsSidebarOpen, menuAnchor, handleProfileClick, handleClose }) {
  return (
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
  );
}