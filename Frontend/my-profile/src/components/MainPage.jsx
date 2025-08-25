// MainPage.jsx
import React, { useState } from "react";
import About from "./About";
import Dashboard from "./Dashboard";
import Header from "./Header";
import Footer from "./Footer";
import Sidebar from "./Sidebar";
import Chat from "./Chat";
import AIAssistant from "./AIAssistant";

const MENU_ITEMS = [
  { key: "about", label: "About us" },
  { key: "dashboard", label: "My Workspace" },
  { key: "chat", label: "Conversations" },
  { key: "ai", label: "AI Assistant 🤖" }, // label can change anytime
];

const VIEWS = {
  about: <About />,
  dashboard: <Dashboard />,
  chat: <Chat />,
  ai: <AIAssistant />,
};

export default function MainPage() {
  const [currentKey, setCurrentKey] = useState("about");
  const [isCollapsed, setIsCollapsed] = useState(true);

  const toggleCollapse = () => setIsCollapsed((prev) => !prev);

  return (
    <div className="relative h-screen overflow-hidden">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-blue-800">
        <Header isCollapsed={isCollapsed} toggleCollapse={toggleCollapse} />
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <Footer />
      </div>

      {/* Main Content Area: Sidebar + Page content */}
      <div className="pt-16 pb-16 h-full flex relative">
        <div className="flex-1 flex relative w-full">
          {/* Sidebar */}
          <Sidebar
            items={MENU_ITEMS}
            currentKey={currentKey}
            setCurrentKey={setCurrentKey}
            isCollapsed={isCollapsed}
            setIsCollapsed={setIsCollapsed}
          />

          {/* Main content area with click-to-collapse */}
          <main
            className={`flex-1 overflow-auto bg-white p-4 transition-all duration-300 ease-in-out ${
              isCollapsed ? "pl-0" : "pl-48"
            }`}
            onClick={() => {
              if (!isCollapsed) setIsCollapsed(true);
            }}
          >
            {VIEWS[currentKey]}
          </main>
        </div>
      </div>
    </div>
  );
}
