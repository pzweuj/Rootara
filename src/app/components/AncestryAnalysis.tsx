import React from "react";

const AncestryAnalysis: React.FC = () => {
  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold mb-4">祖源分析</h3>
        <p className="text-gray-600">祖源分析结果：亚洲 80%，欧洲 15%，非洲 5%</p>
        {/* 在这里插入图片 */}
        <img src="/path/to/ancestry-image.png" alt="祖源分析" className="mt-4" />
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold mb-4">Y染色体单倍群</h3>
        <p className="text-gray-600">Y染色体单倍群：O2a1</p>
        {/* 在这里插入图片 */}
        <img src="/path/to/y-chromosome-image.png" alt="Y染色体单倍群" className="mt-4" />
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold mb-4">MT线粒体单倍群</h3>
        <p className="text-gray-600">MT线粒体单倍群：D4</p>
        {/* 在这里插入图片 */}
        <img src="/path/to/mt-dna-image.png" alt="MT线粒体单倍群" className="mt-4" />
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold mb-4">尼安德特比例</h3>
        <p className="text-gray-600">尼安德特比例：2.1%</p>
        {/* 在这里插入图片 */}
        <img src="/path/to/neanderthal-image.png" alt="尼安德特比例" className="mt-4" />
      </div>
    </div>
  );
};

export default AncestryAnalysis;