import React, { useState } from 'react';
import TreeDiagram from './TreeView';

const MTHaplogroup: React.FC = () => {
  const [treeData] = useState({
    name: 'MT',
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
      <h3 className="text-xl font-semibold mb-4">线粒体单倍群</h3>
      <p className="text-gray-600">线粒体单倍群: F1a1</p>
      <TreeDiagram 
        treeData={treeData}
        highlightedNode="L2a"
      />
    </div>
  );
};

export default MTHaplogroup;