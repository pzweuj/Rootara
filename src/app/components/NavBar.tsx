"use client";

import { ReactNode } from "react";

interface NavBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  tabItems: string[];
  userProfile: ReactNode;
}

export default function NavBar({ activeTab, onTabChange, tabItems, userProfile }: NavBarProps) {
  return (
    <nav className="w-64 h-screen bg-gray-50 shadow-lg p-6 flex flex-col justify-between sticky top-0">
      <div>
        <h1
          onClick={() => onTabChange("主页")}
          className="text-2xl font-semibold mb-6 text-gray-700 hover:text-gray-900 transition duration-300 cursor-pointer"
        >
          Rootara
        </h1>
        <ul>
          {tabItems
            .filter(tab => tab !== "主页")
            .map((tab) => (
              <li key={tab} className="mb-4">
                <button
                  className={`w-full text-left text-gray-600 hover:text-gray-800 hover:bg-gray-200 transition duration-300 p-2 block ${
                    activeTab === tab ? "bg-gray-200 text-gray-700" : ""
                  }`}
                  onClick={() => onTabChange(tab)}
                >
                  {tab}
                </button>
              </li>
            ))}
        </ul>
      </div>
      {userProfile}
    </nav>
  );
}