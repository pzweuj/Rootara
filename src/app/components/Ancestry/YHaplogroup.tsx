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

const YHaplogroup: React.FC<Props> = ({ highlightedNode }) => {
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchData = async () => {
      try {
        const response = await fetch('/lib/ancestry/y_tree.json', {
          signal: abortController.signal
        });
        const data = await response.json();
        
        // 直接处理数据
        processDataInChunks(data, (chunk) => {
          setTreeData(prev => ({
            ...(prev || {}),
            children: [...((prev?.children) || []), ...chunk]
          }));
        });
        setIsLoading(false);
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
      setTreeData(null);
      setIsLoading(true);
    };
  }, []);

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

      // 修改：直接使用第一个有效节点作为根节点
      if (result.length > 0) {
        setTreeData(result[0]);
      }

      if (index < entries.length) {
        requestIdleCallback(processChunk);
      } else {
        setIsLoading(false);
      }
    };

    requestIdleCallback(processChunk);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">Y染色体单倍群</h3>
      {isLoading ? (
        <div>正在加载数据，请稍候...</div>
      ) : (
        <>
          <p className="text-gray-600">Y染色体单倍群: {highlightedNode}</p>
          {treeData && (
            <TreeDiagram 
              treeData={treeData}
              highlightedNode={highlightedNode}
              highlightColor="#7f7fff"
            />
          )}
        </>
      )}
    </div>
  );
};

export default YHaplogroup;