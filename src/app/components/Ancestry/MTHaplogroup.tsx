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
  const [treeData, setTreeData] = useState<TreeNode>({ name: 'MT-Eve', children: [] });
  const [isLoading, setIsLoading] = useState(true);

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

  const processDataInChunks = (data: RawDataNode, callback: (result: TreeNode[]) => void) => {
    const entries = Object.entries(data);
    let index = 0;
    const chunkSize = 100;

    const processChunk = () => {
      const startTime = performance.now();
      const result: TreeNode[] = [];

      while (index < entries.length && performance.now() - startTime < 16) {
        const [key, value] = entries[index];
        if (!key.startsWith('_uk_')) {
          const node: TreeNode = { name: key };
          
          const hasValidChildren = Object.keys(value).some(
            k => !k.startsWith('_uk_') && k !== 'mutations'
          );
          
          if (hasValidChildren && typeof value === 'object') {
            node.children = transformData(value as RawDataNode, 0);
          }
          
          result.push(node);
        }
        index++;
      }

      callback(result);

      if (index < entries.length) {
        requestIdleCallback(processChunk);
      } else {
        setIsLoading(false);
      }
    };

    requestIdleCallback(processChunk);
  };

  useEffect(() => {
    const abortController = new AbortController();

    const fetchData = async () => {
      try {
        const response = await fetch('/lib/ancestry/mt_tree.json', {
          signal: abortController.signal
        });
        const data = await response.json();
        
        processDataInChunks(data, (chunk) => {
          setTreeData(prev => ({
            ...prev,
            children: [...(prev.children || []), ...chunk]
          }));
        });
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Failed to fetch data:', error);
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      abortController.abort();
      setTreeData({ name: 'MT-Eve', children: [] });
      setIsLoading(true);
    };
  }, []);

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">线粒体单倍群</h3>
      {isLoading ? (
        <div>正在加载数据，请稍候...</div>
      ) : (
        <>
          <p className="text-gray-600">线粒体单倍群: {highlightedNode}</p>
          <TreeDiagram 
            treeData={treeData}
            highlightedNode={highlightedNode}
            highlightColor="#ff7f7f"
          />
        </>
      )}
    </div>
  );
};

export default MTHaplogroup;