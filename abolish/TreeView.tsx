import React, { useEffect, useRef, useState } from "react"
import Tree, { TreeNodeDatum } from "react-d3-tree"

interface TreeNode {
  name: string
  children?: TreeNode[]
}

interface TreeDiagramProps {
  treeData: TreeNode
  highlightedNode: string
  width?: number | string
  height?: number | string
  highlightColor?: string
}

interface CustomNodeElementProps {
  nodeDatum: TreeNodeDatum
  toggleNode: () => void
  onNodeClick?: (
    event: React.MouseEvent<SVGGElement>,
    nodeDatum: TreeNodeDatum
  ) => void
  onNodeMouseOver?: (
    event: React.MouseEvent<SVGGElement>,
    nodeDatum: TreeNodeDatum
  ) => void
  onNodeMouseOut?: (
    event: React.MouseEvent<SVGGElement>,
    nodeDatum: TreeNodeDatum
  ) => void
}

const TreeDiagram: React.FC<TreeDiagramProps> = ({
  treeData,
  highlightedNode,
  width = "100%",
  height = "250px",
  highlightColor = "#a0c4ff",
}) => {
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [isClient, setIsClient] = useState(false)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const treeContainerRef = useRef<HTMLDivElement>(null)
  const treeRef = useRef<any>(null)
  const uniqueId = useRef(
    `tree-diagram-${Math.random().toString(36).slice(2, 11)}`
  )

  const updateDimensions = () => {
    if (treeContainerRef.current) {
      const rect = treeContainerRef.current.getBoundingClientRect()
      setDimensions({
        width: rect.width,
        height: rect.height,
      })
      setTranslate({
        x: rect.width / 2,
        y: rect.height / 2,
      })
    }
  }

  useEffect(() => {
    setIsClient(true)
    updateDimensions()

    // 添加窗口resize事件监听
    const handleResize = () => {
      updateDimensions()
    }

    window.addEventListener("resize", handleResize)

    // 清理函数
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  const findNodePath = (
    node: TreeNode,
    targetName: string,
    path: string[] = []
  ): string[] => {
    const currentPath = [...path, node.name]

    if (node.name === targetName) {
      return currentPath
    }

    if (node.children) {
      for (let child of node.children) {
        const result = findNodePath(child, targetName, currentPath)
        if (result.length > 0) {
          return result
        }
      }
    }

    return []
  }

  const expandToNode = async (path: string[]) => {
    if (!treeRef.current) return

    console.log(`Expanding path: ${path.join(" -> ")}`)

    // 使用更可靠的方式获取节点
    const nodes = treeRef.current.state?.data?.children || []
    const nodeMap = new Map<string, any>()

    // 递归遍历节点树
    const traverseNodes = (nodes: any[], parentPath: string[] = []) => {
      nodes.forEach((node) => {
        const currentPath = [...parentPath, node.name]
        nodeMap.set(node.name, { ...node, path: currentPath })

        if (node.children) {
          traverseNodes(node.children, currentPath)
        }
      })
    }

    traverseNodes(nodes)

    const expandNode = async (currentPath: string[]) => {
      if (currentPath.length === 0) return

      const currentNodeName = currentPath[0]
      const currentNode = nodeMap.get(currentNodeName)

      if (currentNode) {
        // 确保节点存在且未展开
        if (!treeRef.current.state.expandedNodeIds?.[currentNode.__rd3t.id]) {
          treeRef.current.onNodeToggle(currentNode.__rd3t.id)
        }

        // 等待动画完成
        await new Promise((resolve) => setTimeout(resolve, 300))

        // 递归展开子节点
        await expandNode(currentPath.slice(1))
      }
    }

    await expandNode(path)
  }

  useEffect(() => {
    if (highlightedNode) {
      const path = findNodePath(treeData, highlightedNode)
      if (path.length > 0) {
        console.log(`Found target path: ${path.join(" -> ")}`)
        // 等待树图完全渲染
        setTimeout(async () => {
          try {
            await expandToNode(path)
          } catch (error) {
            console.error("Error expanding nodes:", error)
          }
        }, 500) // 增加初始延迟确保树图完全加载
      } else {
        console.warn(`Target node ${highlightedNode} not found in tree`)
      }
    }
  }, [highlightedNode, treeData])

  const highlightedPath = findNodePath(treeData, highlightedNode)

  const renderCustomNodeElement = (rd3tNodeProps: CustomNodeElementProps) => {
    const {
      nodeDatum,
      toggleNode,
      onNodeClick,
      onNodeMouseOver,
      onNodeMouseOut,
    } = rd3tNodeProps
    const hasChildren = nodeDatum.children && nodeDatum.children.length > 0
    const isHighlighted = highlightedPath.includes(nodeDatum.name)

    return (
      <g
        onClick={(e) => {
          toggleNode()
          onNodeClick?.(e, nodeDatum)
        }}
        onMouseOver={(e) => onNodeMouseOver?.(e, nodeDatum)}
        onMouseOut={(e) => onNodeMouseOut?.(e, nodeDatum)}
      >
        <circle
          r={6} // 圆点大小
          fill={
            isHighlighted
              ? hasChildren
                ? highlightColor
                : "#fff"
              : hasChildren
                ? "#9ca3af"
                : "#fff"
          }
          stroke={isHighlighted ? highlightColor : "#9ca3af"}
          strokeWidth={2}
        />
        <text
          style={{
            fill: isHighlighted ? highlightColor : "#6b7280",
            fontSize: "8px !important",
            fontWeight: "100 !important",
            userSelect: "none",
            dominantBaseline: "middle",
            fontFamily: "Arial Narrow, sans-serif !important",
          }}
          x={15}
          dy={5}
        >
          {nodeDatum.name}
        </text>
      </g>
    )
  }

  if (!isClient) {
    return (
      <div
        ref={treeContainerRef}
        style={{
          width,
          height,
          border: "1px solid #ddd",
          position: "relative",
          overflow: "hidden",
        }}
      />
    )
  }

  return (
    <>
      <style>
        {`
          .${uniqueId.current} .highlighted-path {
            stroke: ${highlightColor} !important;
            stroke-width: 3px !important;
            z-index: 2;
            pointer-events: none;
          }
          .${uniqueId.current} .hidden-path {
            stroke: transparent !important;
            stroke-width: 0 !important;
          }
          .${uniqueId.current} .rd3t-link {
            stroke: #9ca3af;
            stroke-width: 1px;
            z-index: 1;
          }
          .${uniqueId.current} .rd3t-label {
            fill: #6b7280 !important;
          }
          .${uniqueId.current} .rd3t-label.highlighted {
            fill: ${highlightColor} !important;
          }
        `}
      </style>

      <div
        className={uniqueId.current}
        ref={treeContainerRef}
        style={{
          width,
          height,
          border: "1px solid #ddd",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ width: "100%", height: "100%", position: "absolute" }}>
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
            separation={{ siblings: 0.3, nonSiblings: 0.6 }}
            draggable={true}
            initialDepth={0}
            pathClassFunc={(link) => {
              const sourceIndex = highlightedPath.indexOf(link.source.data.name)
              const targetIndex = highlightedPath.indexOf(link.target.data.name)

              if (
                sourceIndex !== -1 &&
                targetIndex !== -1 &&
                Math.abs(sourceIndex - targetIndex) === 1
              ) {
                return "highlighted-path"
              }
              return "rd3t-link"
            }}
          />
        </div>
      </div>
    </>
  )
}

export default TreeDiagram
