// MainPage.jsx
import React from "react";
import { Routes, Route, Navigate } from 'react-router-dom';
import Header from "./Header";
import Footer from "./Footer";
import AIAssistant from "./AIAssistant";
import Welcome from "./Welcome";

// No header menu — use deep links or Welcome actions

// Note: Views are now routed with react-router-dom

export default function MainPage() {

  return (
    <div className="relative h-screen overflow-hidden">
      {/* Header with top navigation */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-blue-800">
        <Header />
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <Footer />
      </div>

      {/* Main Content Area */}
      <div className="pt-12 pb-16 h-full flex relative">
        <main className="flex-1 overflow-auto bg-white p-4">
          <Routes>
            <Route path="/" element={<Navigate to="/welcome" replace />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/ai" element={<AIAssistant />} />
            <Route path="/ai/:agentId" element={<AIAssistant />} />
            <Route path="/agent/:agentId" element={<AIAssistant />} />
            <Route path="/a/:agentId" element={<AIAssistant />} />
            {/* Additional routes can be added here if needed */}
            <Route path="*" element={<Navigate to="/welcome" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
