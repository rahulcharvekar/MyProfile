import React, { useState } from "react";
import About from "./About";
import Contact from "./Contact";
import Dashboard from "./Dashboard";
import Header from './Header';
import Footer from './Footer';
import Sidebar from './Sidebar';

export default function MainPage() {
  const [currentPage, setCurrentPage] = useState("about");
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  const renderPage = () => {
    switch (currentPage) {
      case "contact":
        return <Contact />;
      case "dashboard":
        return <Dashboard />;
      case "about":
      default:
        return <About />;
    }
  };

  return (
    <div className="relative h-screen overflow-hidden">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-10">
        <Header />
      </div>

      {/* Fixed Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-10">
        <Footer />
      </div>

      {/* Content area between header and footer */}
      <div className="pt-16 pb-16 h-full flex">
        {/* Sidebar */}
        <Sidebar
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          isCollapsed={isCollapsed}
          toggleCollapse={toggleCollapse}
        />

        {/* Main Content Scrollable */}
        <main className="flex-1 overflow-auto bg-white p-4">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
