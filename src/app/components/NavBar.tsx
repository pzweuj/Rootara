"use client";

import { ReactNode, useState } from "react";
import { 
  ChevronLeftIcon, 
  ChevronRightIcon,
  GlobeAsiaAustraliaIcon,  // 祖源分析
  HeartIcon,               // 遗传性疾病
  BeakerIcon,             // 药物反应
  FingerPrintIcon,        // 遗传特征
  UserCircleIcon          // 我的模块
} from "@heroicons/react/24/outline";
import HomePage from "./HomePage";
import AncestryAnalysis from "./AncestryAnalysis";
import CharacterAnalysis from "./CharacterAnalysis";

interface NavBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  userProfile: ReactNode;
  userAvatar: ReactNode;  // 新增用户头像属性
}

const TAB_ITEMS = [
  { name: "祖源分析", icon: GlobeAsiaAustraliaIcon },
  { name: "遗传性疾病", icon: HeartIcon },
  { name: "药物反应", icon: BeakerIcon },
  { name: "遗传特征", icon: FingerPrintIcon },
  { name: "我的模块", icon: UserCircleIcon }
];

export default function NavBar({ activeTab, onTabChange, userProfile, userAvatar }: NavBarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const renderTabContent = () => {
    if (activeTab === "主页") {
      return <HomePage />;
    }
    switch (activeTab) {
      case "祖源分析":
        return <AncestryAnalysis />;
      case "遗传性疾病":
        return <div>遗传性疾病内容</div>;
      case "药物反应":
        return <div>药物反应内容</div>;
      case "遗传特征":
        return <div>遗传特征内容</div>;
        // return <CharacterAnalysis />
      case "我的模块":
        return <div>我的模块内容</div>;
      default:
        return null;
    }
  };

  return (
    <>
      <nav 
        className={`${
          isCollapsed ? 'w-16' : 'w-64'
        } h-screen bg-gray-50 shadow-lg ${isCollapsed ? 'p-3' : 'p-6'} flex flex-col justify-between sticky top-0 transition-all duration-300`}
      >
        <div>
          <div className="flex items-center justify-between mb-6">
            {!isCollapsed && (
              <div className="flex items-center gap-2">
                <h1
                  onClick={() => onTabChange("主页")}
                  className="text-2xl font-semibold text-gray-700 hover:text-gray-900 transition duration-300 cursor-pointer"
                >
                  Rootara
                </h1>
                <button
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="p-1 hover:bg-gray-200 rounded-full"
                >
                  <ChevronLeftIcon className="w-5 h-5" />
                </button>
              </div>
            )}
            {isCollapsed && (
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-1 hover:bg-gray-200 rounded-full mx-auto"
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            )}
          </div>
          <ul className={`${isCollapsed ? 'px-0' : ''}`}>
            {TAB_ITEMS.map((tab) => {
              const Icon = tab.icon;
              return (
                <li key={tab.name} className="mb-4">
                  <button
                    className={`w-full text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition duration-300 p-2 ${
                      activeTab === tab.name ? "bg-gray-200 text-gray-700" : ""
                    } ${isCollapsed ? 'flex justify-center items-center' : 'flex items-center gap-2'}`}
                    onClick={() => onTabChange(tab.name)}
                  >
                    <Icon className="w-5 h-5 min-w-5" />
                    {!isCollapsed && <span>{tab.name}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className={`${isCollapsed ? 'flex justify-center items-center' : ''}`}>
          {isCollapsed ? (
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
              <div className="w-full h-full">
                {userAvatar}
              </div>
            </div>
          ) : (
            userProfile
          )}
        </div>
      </nav>
      <main className="flex-1 overflow-y-auto h-screen">
        <div className="p-8 bg-white">
          <h2 className="text-2xl font-semibold mb-6 text-gray-800">{activeTab}</h2>
          {renderTabContent()}
        </div>
      </main>
    </>
  );
}