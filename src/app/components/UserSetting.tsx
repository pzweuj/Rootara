"use client";

import { useState, useRef, useEffect } from "react";

export default function UserProfile() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center cursor-pointer" onClick={toggleDropdown}>
        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
          <span className="text-gray-600 text-lg">U</span>
        </div>
        <div className="ml-3">
          <p className="text-gray-700 font-medium">Username</p>
          <p className="text-sm text-gray-500">user@example.com</p>
        </div>
      </div>

      {isDropdownOpen && (
        <div className="absolute bottom-16 left-0 w-48 bg-white shadow-lg rounded-lg mt-2 overflow-hidden">
          <ul>
            <li>
              <a href="#" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors duration-200">
                系统设置
              </a>
            </li>
            <li>
              <a href="#" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors duration-200">
                结果分享
              </a>
            </li>
            <li>
              <a href="#" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors duration-200">
                退出登录
              </a>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}