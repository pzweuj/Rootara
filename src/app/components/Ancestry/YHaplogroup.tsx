import React, { useState } from 'react';
import TreeDiagram from './TreeView';

const YHaplogroup: React.FC = () => {
  const [treeData] = useState({
    name: 'Y-Adam',
    children: [
      {
        name: 'L1',
        children: [
          { name: 'L1a' },
          { name: 'L1b' },
        ],
      },
      {
        name: 'L2',
        children: [
          { name: 'L2a' },
          { name: 'L2b' },
        ],
      },
    ],
  });

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">Y染色体单倍群</h3>
      <p className="text-gray-600">Y染色体单倍群: O2a1</p>
      <TreeDiagram 
        treeData={treeData}
        highlightedNode="L2b"
      />
    </div>
  );
};

export default YHaplogroup;