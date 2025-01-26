import React, { useState } from "react";
import AncestryMap from "./Ancestry/AncestryMap";
import HaplogroupY from "./Ancestry/YHaplogroup";
import HaplogroupMT from "./Ancestry/MTHaplogroup";
import Neanderthal from "./Ancestry/Neanderthal";

const AncestryAnalysis: React.FC = () => {
  return (
    <div className="grid grid-cols-1 gap-6">
      <AncestryMap />
      <HaplogroupY highlightedNode="F1a1" />
      <HaplogroupMT highlightedNode="L1c3" />
      <Neanderthal />
    </div>
  );
};

export default AncestryAnalysis;