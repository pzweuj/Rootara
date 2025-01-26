import React, { useState, Suspense, lazy } from "react";
import AncestryMap from "./Ancestry/AncestryMap";
import Neanderthal from "./Ancestry/Neanderthal";

// 使用lazy加载
const HaplogroupY = lazy(() => import("./Ancestry/YHaplogroup"));
const HaplogroupMT = lazy(() => import("./Ancestry/MTHaplogroup"));

const AncestryAnalysis: React.FC = () => {
  return (
    <div className="grid grid-cols-1 gap-6">
      <AncestryMap />
      <Suspense fallback={<div>加载Y染色体单倍群...</div>}>
        <HaplogroupY highlightedNode="O2a1a1a2" />
      </Suspense>
      <Suspense fallback={<div>加载线粒体单倍群...</div>}>
        <HaplogroupMT highlightedNode="F1a1" />
      </Suspense>
      <Neanderthal percentage={2.1}/>
    </div>
  );
};

export default AncestryAnalysis;