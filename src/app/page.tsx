"use client";

import { useState, useRef, useEffect } from "react";
import AncestryAnalysis from "./components/AncestryAnalysis";
import NavBar from "./components/NavBar";
import UserProfile from "./components/UserSetting";

const TAB_ITEMS = [
  "祖源分析",
  "遗传性疾病", 
  "药物反应",
  "遗传特征",
  "我的模块"
];

const renderTabContent = (activeTab: string) => {
  switch (activeTab) {
    case "祖源分析":
      return <AncestryAnalysis />;
    case "遗传性疾病":
      return <div>遗传性疾病内容</div>;
    case "药物反应":
      return <div>药物反应内容</div>;
    case "遗传特征":
      return <div>遗传特征内容</div>;
    case "我的模块":
      return <div>我的模块内容</div>;
    default:
      return null;
  }
};

export default function Home() {
  const [activeTab, setActiveTab] = useState(TAB_ITEMS[0]);

  return (
    <div className="min-h-screen flex bg-gray-50">
      <NavBar 
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabItems={TAB_ITEMS}
        userProfile={<UserProfile />}
      />
      
      <MainContent activeTab={activeTab} />
    </div>
  );
}

function MainContent({ activeTab }: { activeTab: string }) {
  return (
    <main className="flex-1 overflow-y-auto h-screen">
      <div className="p-8 bg-white">
        <h2 className="text-2xl font-semibold mb-6 text-gray-800">{activeTab}</h2>
        {renderTabContent(activeTab)}
      </div>
    </main>
  );
}