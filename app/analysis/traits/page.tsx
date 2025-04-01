"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Download, Share2, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { TraitHighlights } from "@/components/trait-highlights"

const traitCategories = [
  { id: "appearance", name: "Physical Appearance" },
  { id: "sensory", name: "Sensory Abilities" },
  { id: "nutrition", name: "Nutrition & Metabolism" },
  { id: "sleep", name: "Sleep Patterns" },
  { id: "cognitive", name: "Cognitive Traits" },
]

const allTraits = [
  {
    id: "eye-color",
    name: "Eye Color",
    category: "appearance",
    result: "Brown",
    description: "You have genetic markers associated with brown eyes.",
    confidence: "high",
  },
  {
    id: "hair-type",
    name: "Hair Type",
    category: "appearance",
    result: "Straight",
    description: "Your genetic profile indicates straight hair texture.",
    confidence: "high",
  },
  {
    id: "earwax-type",
    name: "Earwax Type",
    category: "appearance",
    result: "Wet",
    description: "You have the genetic variant associated with wet earwax.",
    confidence: "high",
  },
  {
    id: "bitter-taste",
    name: "Bitter Taste Perception",
    category: "sensory",
    result: "Taster",
    description: "You can likely taste bitter compounds like PTC.",
    confidence: "medium",
  },
  {
    id: "caffeine-metabolism",
    name: "Caffeine Metabolism",
    category: "nutrition",
    result: "Slow Metabolizer",
    description: "You may be more sensitive to caffeine's effects.",
    confidence: "medium",
  },
  {
    id: "lactose-tolerance",
    name: "Lactose Tolerance",
    category: "nutrition",
    result: "Tolerant",
    description: "You likely maintain the ability to digest lactose into adulthood.",
    confidence: "high",
  },
  {
    id: "alcohol-flush",
    name: "Alcohol Flush Reaction",
    category: "nutrition",
    result: "Unlikely",
    description: "You are unlikely to experience facial flushing after alcohol consumption.",
    confidence: "high",
  },
  {
    id: "sleep-depth",
    name: "Sleep Depth",
    category: "sleep",
    result: "Light Sleeper",
    description: "Your genetic profile suggests you may be a lighter sleeper.",
    confidence: "medium",
  },
  {
    id: "chronotype",
    name: "Chronotype",
    category: "sleep",
    result: "Night Owl",
    description: "Your genetic profile suggests you may naturally prefer staying up late.",
    confidence: "high",
  },
  {
    id: "memory-performance",
    name: "Memory Performance",
    category: "cognitive",
    result: "Typical",
    description: "Your genetic markers suggest typical memory performance.",
    confidence: "low",
  },
]

export default function TraitsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")

  const filteredTraits = allTraits.filter((trait) => {
    const matchesSearch = trait.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "all" || trait.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const getConfidenceBadge = (confidence) => {
    const styles = {
      high: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      low: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[confidence]}`}>
        {confidence.charAt(0).toUpperCase() + confidence.slice(1)} confidence
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trait Interpretation</h1>
          <p className="text-muted-foreground">Explore how your genetics influence your traits</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
          <Button variant="outline">
            <Share2 className="mr-2 h-4 w-4" />
            Share Results
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trait Highlights</CardTitle>
          <CardDescription>Notable genetic traits based on your DNA</CardDescription>
        </CardHeader>
        <CardContent>
          <TraitHighlights />
        </CardContent>
      </Card>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative w-full md:w-1/3">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search traits..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Tabs
          defaultValue="all"
          className="w-full md:w-2/3"
          value={selectedCategory}
          onValueChange={setSelectedCategory}
        >
          <TabsList className="w-full">
            <TabsTrigger value="all">All Traits</TabsTrigger>
            {traitCategories.map((category) => (
              <TabsTrigger key={category.id} value={category.id}>
                {category.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTraits.map((trait) => (
          <Card key={trait.id}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{trait.name}</CardTitle>
                {getConfidenceBadge(trait.confidence)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="text-xl font-bold mb-1">{trait.result}</div>
                <p className="text-sm text-muted-foreground">{trait.description}</p>
              </div>
              <Button variant="outline" size="sm" className="w-full">
                View Details
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

