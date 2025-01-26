import React, { useEffect, useRef, useState } from 'react';
import Tree, { TreeNodeDatum } from 'react-d3-tree';

interface TreeNode {
  name: string;
  children?: TreeNode[];
}

interface TreeDiagramProps {
  treeData: TreeNode;
  highlightedNode: string;
  width?: number | string;
  height?: number | string;
}

interface CustomNodeElementProps {
  nodeDatum: TreeNodeDatum;
  toggleNode: () => void;
  onNodeClick?: (event: React.MouseEvent<SVGGElement>, nodeDatum: TreeNodeDatum) => void;
  onNodeMouseOver?: (event: React.MouseEvent<SVGGElement>, nodeDatum: TreeNodeDatum) => void;
  onNodeMouseOut?: (event: React.MouseEvent<SVGGElement>, nodeDatum: TreeNodeDatum) => void;
}

const TreeDiagram: React.FC<TreeDiagramProps> = ({
  treeData,
  highlightedNode,
  width = '100%',
  height = '200px'
}) => {
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isClient, setIsClient] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<any>(null);

  useEffect(() => {
    setIsClient(true);
    if (treeContainerRef.current) {
      const rect = treeContainerRef.current.getBoundingClientRect();
      setDimensions({
        width: rect.width,
        height: rect.height
      });
      setTranslate({
        x: rect.width / 2,
        y: 50
      });
    }
  }, []);

  const findNodePath = (node: TreeNode, targetName: string, path: string[] = []): string[] => {
    const currentPath = [...path, node.name];
    
    if (node.name === targetName) {
      return currentPath;
    }
    
    if (node.children) {
      for (let child of node.children) {
        const result = findNodePath(child, targetName, currentPath);
        if (result.length > 0) {
          return result;
        }
      }
    }
    
    return [];
  };

  const expandToNode = async (path: string[]) => {
    if (!treeRef.current) return;
    
    console.log(`Expanding path: ${path.join(' -> ')}`);
    
    for (let i = 0; i < path.length; i++) {
      const nodeName = path[i];
      if (treeRef.current.getNodeById(nodeName)) {
        console.log(`Expanding node: ${nodeName}`);
        treeRef.current.expandNode(nodeName);
        await new Promise(resolve => setTimeout(resolve, 200));
      } else {
        console.warn(`Node not found: ${nodeName}`);
      }
    }
  };

  useEffect(() => {
    if (highlightedNode) {
      const path = findNodePath(treeData, highlightedNode);
      if (path.length > 0) {
        console.log(`Found target path: ${path.join(' -> ')}`);
        setTimeout(() => {
          expandToNode(path);
        }, 100);
      } else {
        console.warn(`Target node ${highlightedNode} not found in tree`);
      }
    }
  }, [highlightedNode, treeData]);

  const highlightedPath = findNodePath(treeData, highlightedNode);

  const renderCustomNodeElement = (rd3tNodeProps: CustomNodeElementProps) => {
    const { nodeDatum, toggleNode } = rd3tNodeProps;
    const hasChildren = nodeDatum.children && nodeDatum.children.length > 0;
    const isHighlighted = highlightedPath.includes(nodeDatum.name);
    
    return (
      <g>
        <circle
          r={10}
          fill={isHighlighted ? (hasChildren ? '#a0c4ff' : '#fff') : (hasChildren ? '#9ca3af' : '#fff')}
          stroke={isHighlighted ? '#a0c4ff' : '#9ca3af'}
          strokeWidth={2}
          onClick={toggleNode}
        />
        <text
          fill={isHighlighted ? '#a0c4ff' : '#6b7280'}
          x={15}
          dy={5}
        >
          {nodeDatum.name}
        </text>
      </g>
    );
  };

  if (!isClient) {
    return (
      <div 
        ref={treeContainerRef}
        style={{ 
          width, 
          height, 
          border: '1px solid #ddd', 
          position: 'relative',
          overflow: 'hidden'
        }}
      />
    );
  }

  return (
    <div 
      ref={treeContainerRef}
      style={{ 
        width, 
        height, 
        border: '1px solid #ddd', 
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style={{ width: '100%', height: '100%', position: 'absolute' }}>
        <Tree
          ref={treeRef}
          data={treeData}
          orientation="horizontal"
          translate={translate}
          dimensions={dimensions}
          renderCustomNodeElement={renderCustomNodeElement}
          pathFunc="step"
          zoomable={true}
          zoom={1}
          transitionDuration={300}
          scaleExtent={{ min: 0.1, max: 2 }}
          separation={{ siblings: 0.5, nonSiblings: 1 }}
          draggable={true}
          initialDepth={0}
        />
      </div>
    </div>
  );
};

export default TreeDiagram;