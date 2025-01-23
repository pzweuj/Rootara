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
        <div className="text-2xl font-semibold mb-6 text-gray-700">Rootara</div>
        <ul>
          {tabItems.map((tab) => (
            <li key={tab} className="mb-4">
              <a
                href="#"
                className={`text-gray-600 hover:text-white hover:bg-gray-200 transition duration-300 p-2 block ${
                  activeTab === tab ? "bg-gray-200 text-gray-700" : ""
                }`}
                onClick={() => onTabChange(tab)}
              >
                {tab}
              </a>
            </li>
          ))}
        </ul>
      </div>
      {userProfile}
    </nav>
  );
}