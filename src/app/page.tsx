"use client";

import { useState } from "react";
import NavBar from "./components/NavBar";
import UserProfile from "./components/UserSetting";

export default function Home() {
  const [activeTab, setActiveTab] = useState("主页");

  return (
    <div className="min-h-screen flex bg-gray-50">
      <NavBar 
        activeTab={activeTab}
        onTabChange={setActiveTab}
        userProfile={<UserProfile />}
      />
    </div>
  );
}