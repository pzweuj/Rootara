import React, { useState, useEffect } from 'react';
import TreeDiagram from './TreeView';

interface TreeNode {
  name: string;
  children?: TreeNode[];
}

interface RawDataNode {
  [key: string]: RawDataNode | { mutations: string[] };
}

interface Props {
  highlightedNode: string;
}

const MTHaplogroup: React.FC<Props> = ({ highlightedNode }) => {
  const [treeData, setTreeData] = useState<TreeNode>({ name: 'MT', children: [] });

  useEffect(() => {
    const transformData = (data: RawDataNode, depth = 0): TreeNode[] => {
      if (depth > 50) {
        console.warn('Maximum recursion depth reached');
        return [];
      }

      return Object.entries(data).reduce<TreeNode[]>((acc, [key, value]) => {
        if (!key.startsWith('_uk_')) {
          const node: TreeNode = { name: key };
          
          const hasValidChildren = Object.keys(value).some(
            k => !k.startsWith('_uk_') && k !== 'mutations'
          );
          
          if (hasValidChildren && typeof value === 'object') {
            node.children = transformData(value as RawDataNode, depth + 1);
          }
          
          acc.push(node);
        }
        return acc;
      }, []);
    };

    const fetchData = async () => {
      const response = await fetch('/lib/ancestry/mt_tree.json');
      const data = await response.json();
      setTreeData({
        name: 'MT',
        children: transformData(data)
      });
    };
    fetchData();
  }, []);

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">线粒体单倍群</h3>
      <p className="text-gray-600">线粒体单倍群: {highlightedNode}</p>
      <TreeDiagram 
        treeData={treeData}
        highlightedNode={highlightedNode}
        highlightColor="#ff7f7f"
      />
    </div>
  );
};

export default MTHaplogroup;