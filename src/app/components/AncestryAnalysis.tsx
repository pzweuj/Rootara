import React, { useState } from "react";
import AncestryMap from "./AncestryAnalysis/AncestryMap";
import HaplogroupY from "./AncestryAnalysis/HaplogroupY";
import HaplogroupMT from "./AncestryAnalysis/HaplogroupMT";
import Neanderthal from "./AncestryAnalysis/Neanderthal";

const AncestryAnalysis: React.FC = () => {
  const [regions] = useState([
    {
      id: "east-asia",
      name: "东亚",
      percentage: 80,
      coordinates: { cx: 750, cy: 200, r: 30 }
    },
    // ... other regions
  ]);

  return (
    <div className="grid grid-cols-1 gap-6">
      <AncestryMap regions={regions} />
      <HaplogroupY />
      <HaplogroupMT />
      <Neanderthal />
    </div>
  );
};

export default AncestryAnalysis;