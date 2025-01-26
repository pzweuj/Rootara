import React, { useEffect, useState } from 'react';
import Tree from 'react-d3-tree';

const MTHaplogroup: React.FC = () => {
  const [isClient, setIsClient] = useState(false);
  const [treeData, setTreeData] = useState({
    name: 'L0',
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

  useEffect(() => {
    setIsClient(true);
  }, []);

  const renderCustomNodeElement = ({ nodeDatum, toggleNode }) => {
    const hasChildren = nodeDatum.children && nodeDatum.children.length > 0;
    
    return (
      <g>
        <circle
          r={10}
          fill={hasChildren ? '#9ca3af' : '#fff'}
          stroke="#9ca3af"
          strokeWidth={2}
          onClick={toggleNode}
        />
        <text
          fill="black"
          x={15}
          dy={5}
        >
          {nodeDatum.name}
        </text>
      </g>
    );
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">线粒体单倍群</h3>
      <p className="text-gray-600">线粒体单倍群: F1a1</p>
      <div style={{ width: '100%', height: '400px', border: '1px solid #ddd' }}>
        {isClient && (
          <Tree
            data={treeData}
            orientation="horizontal"
            renderCustomNodeElement={renderCustomNodeElement}
            pathFunc="step"
            zoomable={true}
            zoom={1}
            transitionDuration={300}
            scaleExtent={{ min: 0.1, max: 2 }}
            translateExtent={[[0, 0], [1000, 1000]]}
            separation={{ siblings: 1, nonSiblings: 2 }}
          />
        )}
      </div>
    </div>
  );
};

export default MTHaplogroup;