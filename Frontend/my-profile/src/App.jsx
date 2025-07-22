import { useState } from "react";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import MainPage from "./components/MainPage";
import Footer from "./components/Footer";

export default function App() {
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState("home");

  const handleProfileClick = (event) => setMenuAnchor(event.currentTarget);
  const handleClose = () => setMenuAnchor(null);

  return (
    <div className="flex flex-col h-screen">
      <Header
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        menuAnchor={menuAnchor}
        handleProfileClick={handleProfileClick}
        handleClose={handleClose}
      />
      <div className="flex flex-1">
        {isSidebarOpen && (
          <Sidebar onMenuSelect={setCurrentPage} currentPage={currentPage} />
        )}
        <main className="flex-1 bg-white p-6 overflow-auto">
          <div className="bg-gray-100">
            <div className="container mx-auto py-8">
              <div className="grid grid-cols-4 sm:grid-cols-12 gap-6 px-4">
                <div className="col-span-8 sm:col-span-12">
                  <MainPage currentPage={currentPage} />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}