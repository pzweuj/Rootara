import React from 'react';
import Tree from 'react-d3-tree';
import { TreeNodeDatum } from 'react-d3-tree';
import { HierarchyPointNode } from 'd3-hierarchy';

const MTHaplogroup: React.FC = () => {
  const [isClient, setIsClient] = React.useState(false);
  const [dimensions, setDimensions] = React.useState({ x: 200, y: 200 });
  const [toggledIds, setToggledIds] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const handleNodeClick = (node: HierarchyPointNode<TreeNodeDatum>, event: React.MouseEvent) => {
    const nodeDatum = node.data;
    if (!nodeDatum.__rd3t) {
      console.error('Node datum missing __rd3t property');
      return;
    }

    const { id } = nodeDatum;

    // 切换节点的展开/收起状态
    setToggledIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // 示例数据
  const treeData = {
    name: 'L0',
    children: [
      {
        name: 'L1',
        children: [
          { name: 'L1a' },
          { name: 'L1b' }
        ]
      },
      {
        name: 'L2',
        children: [
          { name: 'L2a' },
          { name: 'L2b' }
        ]
      }
    ]
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">线粒体单倍群</h3>
      <p className="text-gray-600">线粒体单倍群：F1a1</p>
      <div 
        style={{ 
          width: '100%', 
          height: '400px',
          position: 'relative',
          border: '1px solid #ddd'
        }}
        id="tree-container"
      >
        {isClient && (
          <Tree
            data={treeData}
            orientation="horizontal"
            translate={dimensions}
            pathFunc="step"
            collapsible={true}
            zoomable={true}
            zoom={0.8}
            onNodeClick={handleNodeClick}
            transitionDuration={300}
            draggable={true}
            enableLegacyTransitions={true}
            separation={{ siblings: 1, nonSiblings: 2 }}
            initialCollapsedIds={Array.from(toggledIds)}
          />
        )}
      </div>
    </div>
  );
};

export default MTHaplogroup;
