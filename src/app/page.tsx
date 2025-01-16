"use client";

import { useState, useRef, useEffect } from "react";
import AncestryAnalysis from "./components/AncestryAnalysis"; // 引入祖源分析组件

export default function Home() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("祖源分析"); // 当前激活的选项卡
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    // 添加全局点击事件监听器
    document.addEventListener("mousedown", handleClickOutside);

    // 清理函数，移除事件监听器
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 渲染右侧内容
  const renderContent = () => {
    switch (activeTab) {
      case "祖源分析":
        return <AncestryAnalysis />; // 使用祖源分析组件
      case "药物指南":
        return <p className="text-gray-600">药物指南内容待添加。</p>;
      case "遗传性疾病":
        return <p className="text-gray-600">遗传性疾病内容待添加。</p>;
      case "遗传特征":
        return <p className="text-gray-600">遗传特征内容待添加。</p>;
      default:
        return <p className="text-gray-600">请选择一个选项以查看内容。</p>;
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* 左侧导航栏 */}
      <nav className="w-64 bg-white shadow-lg p-6 flex flex-col justify-between">
        {/* 导航栏内容 */}
        <div>
          {/* Rootara 标题 */}
          <div className="text-2xl font-semibold mb-6 text-gray-800">Rootara</div>

          {/* 导航链接 */}
          <ul>
            <li className="mb-4">
              <a
                href="#"
                className={`text-gray-700 hover:text-white hover:bg-blue-500 hover:shadow-md transition duration-300 p-2 rounded-lg block ${
                  activeTab === "祖源分析" ? "bg-blue-500 text-white" : ""
                }`}
                onClick={() => setActiveTab("祖源分析")}
              >
                祖源分析
              </a>
            </li>
            <li className="mb-4">
              <a
                href="#"
                className={`text-gray-700 hover:text-white hover:bg-blue-500 hover:shadow-md transition duration-300 p-2 rounded-lg block ${
                  activeTab === "药物指南" ? "bg-blue-500 text-white" : ""
                }`}
                onClick={() => setActiveTab("药物指南")}
              >
                药物指南
              </a>
            </li>
            <li className="mb-4">
              <a
                href="#"
                className={`text-gray-700 hover:text-white hover:bg-blue-500 hover:shadow-md transition duration-300 p-2 rounded-lg block ${
                  activeTab === "遗传性疾病" ? "bg-blue-500 text-white" : ""
                }`}
                onClick={() => setActiveTab("遗传性疾病")}
              >
                遗传性疾病
              </a>
            </li>
            <li className="mb-4">
              <a
                href="#"
                className={`text-gray-700 hover:text-white hover:bg-blue-500 hover:shadow-md transition duration-300 p-2 rounded-lg block ${
                  activeTab === "遗传特征" ? "bg-blue-500 text-white" : ""
                }`}
                onClick={() => setActiveTab("遗传特征")}
              >
                遗传特征
              </a>
            </li>
          </ul>
        </div>

        {/* 用户头像和信息 */}
        <div className="relative" ref={dropdownRef}>
          <div className="flex items-center cursor-pointer" onClick={toggleDropdown}>
            <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-gray-600 text-lg">U</span>
            </div>
            <div className="ml-3">
              <p className="text-gray-800 font-medium">Username</p>
              <p className="text-sm text-gray-500">user@example.com</p>
            </div>
          </div>

          {/* 下拉菜单 */}
          {isDropdownOpen && (
            <div className="absolute bottom-16 left-0 w-48 bg-white shadow-lg rounded-lg mt-2">
              <ul>
                <li>
                  <a href="#" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                    系统设置
                  </a>
                </li>
                <li>
                  <a href="#" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                    结果分享
                  </a>
                </li>
                <li>
                  <a href="#" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                    退出登录
                  </a>
                </li>
              </ul>
            </div>
          )}
        </div>
      </nav>

      {/* 主要内容展示区域 */}
      <main className="flex-1 p-8 bg-white shadow-inner">
        <h2 className="text-2xl font-semibold mb-6 text-gray-800">{activeTab}</h2>
        {renderContent()}
      </main>
    </div>
  );
}