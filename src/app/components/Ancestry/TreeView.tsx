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
  const [scale, setScale] = useState(1);
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<any>(null);

  useEffect(() => {
    setIsClient(true);
    if (treeContainerRef.current) {
      setTranslate({
        x: treeContainerRef.current.clientWidth / 2,
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
        if (result) return result;
      }
    }
    
    return [];
  };

  const highlightedPath = findNodePath(treeData, highlightedNode);

  const handleNodeClick = (nodeDatum: TreeNodeDatum) => {
    if (treeRef.current && nodeDatum) {
      treeRef.current.zoomToNode(nodeDatum, {
        duration: 300,
        scale: 1,
        offsetX: 0,
        offsetY: 0
      });
    }
  };

  const renderCustomNodeElement = (rd3tNodeProps: CustomNodeElementProps) => {
    const { nodeDatum, toggleNode } = rd3tNodeProps;
    const hasChildren = nodeDatum.children && nodeDatum.children.length > 0;
    const isHighlighted = highlightedPath.includes(nodeDatum.name);
    
    return (
      <g>
        <circle
          r={10}
          fill={hasChildren ? '#9ca3af' : '#fff'}
          stroke={isHighlighted ? 'blue' : '#9ca3af'}
          strokeWidth={2}
          onClick={(event: React.MouseEvent<SVGCircleElement>) => {
            toggleNode();
            handleNodeClick(nodeDatum);
          }}
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
          renderCustomNodeElement={renderCustomNodeElement}
          pathFunc="step"
          zoomable={true}
          zoom={1}
          transitionDuration={300}
          scaleExtent={{ min: 0.1, max: 2 }}
          separation={{ siblings: 0.5, nonSiblings: 1 }}
          draggable={true}
        />
      </div>
    </div>
  );
};

export default TreeDiagram;