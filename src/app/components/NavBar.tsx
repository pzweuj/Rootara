"use client";

import React, { ReactNode, useState, useEffect, Suspense } from "react";
import type { JSX } from 'react';
import { 
  ChevronLeftIcon, 
  ChevronRightIcon,
  GlobeAsiaAustraliaIcon,  // 祖源分析
  HeartIcon,               // 遗传性疾病
  BeakerIcon,             // 药物反应
  FingerPrintIcon,        // 遗传特征
  UserCircleIcon          // 我的模块
} from "@heroicons/react/24/outline";

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

// 在组件外部预先加载
const preloadedComponents = {
  HomePage: React.lazy(() => import('./HomePage')),
  AncestryAnalysis: React.lazy(() => import('./AncestryAnalysis')),
  // ... 其他组件
};

type TabKey = "主页" | "祖源分析" | "遗传性疾病" | "药物反应" | "遗传特征" | "我的模块";

const componentsMap: Record<TabKey, JSX.Element> = {
  "主页": <Suspense fallback={<div>加载中...</div>}><preloadedComponents.HomePage /></Suspense>,
  "祖源分析": <Suspense fallback={<div>加载中...</div>}>
    <div className="w-full h-full">
      <preloadedComponents.AncestryAnalysis key="ancestry-analysis" />
    </div>
  </Suspense>,
  "遗传性疾病": <div>遗传性疾病内容</div>,
  "药物反应": <div>药物反应内容</div>,
  "遗传特征": <div>遗传特征内容</div>,
  "我的模块": <div>我的模块内容</div>
};

export default function NavBar({ activeTab, onTabChange, userProfile, userAvatar }: NavBarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    // 创建媒体查询，检查窗口宽度是否小于 768px
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    
    // 根据媒体查询结果设置侧边栏状态
    const handleResize = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsCollapsed(e.matches);
    };

    // 初始化时检查一次
    handleResize(mediaQuery);

    // 添加监听器
    mediaQuery.addEventListener('change', handleResize);

    // 清理监听器
    return () => mediaQuery.removeEventListener('change', handleResize);
  }, []);

  const renderTabContent = () => {
    return componentsMap[activeTab as TabKey] || null;
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
          <Suspense fallback={<div>加载中...</div>}>
            {componentsMap[activeTab as TabKey]}
          </Suspense>
        </div>
      </main>
    </>
  );
}