import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Download, Share2, Eye, Dna, Heart, Brain, Database } from "lucide-react"
import Link from "next/link"
import { ReportSwitcher } from "@/components/report-switcher"

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">My Reports</h1>
      </div>

      <ReportSwitcher />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ancestry">Ancestry</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="traits">Traits</TabsTrigger>
          <TabsTrigger value="raw-data">Raw Data</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ancestry Composition</CardTitle>
                <Dna className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">4 Regions</div>
                <p className="text-xs text-muted-foreground">East Asian, European, South Asian, African</p>
                <div className="mt-4">
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href="/analysis/ancestry">View Details</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Health Risks</CardTitle>
                <Heart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">5 Markers</div>
                <p className="text-xs text-muted-foreground">2 elevated, 1 reduced, 2 average</p>
                <div className="mt-4">
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href="/analysis/health">View Details</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Genetic Traits</CardTitle>
                <Brain className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">127 Traits</div>
                <p className="text-xs text-muted-foreground">Physical, sensory, and behavioral traits</p>
                <div className="mt-4">
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href="/analysis/traits">View Details</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Raw Data</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">635,287 SNPs</div>
                <p className="text-xs text-muted-foreground">Analyzed from 23andMe v4 format</p>
                <div className="mt-4">
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href="/analysis/raw-data">View Details</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Report Summary</CardTitle>
              <CardDescription>Key findings from your genetic analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">Ancestry Highlights</h3>
                <p className="text-sm text-muted-foreground">
                  Your DNA indicates ancestry primarily from East Asia (45%), with significant European (30%), South
                  Asian (15%), and African (10%) components. Your maternal haplogroup is H1c3, common in European
                  populations.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">Health Insights</h3>
                <p className="text-sm text-muted-foreground">
                  Your genetic profile shows a slightly elevated risk for Coronary Heart Disease and Macular
                  Degeneration, average risk for Type 2 Diabetes and Celiac Disease, and reduced risk for Alzheimer's
                  Disease.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">Notable Traits</h3>
                <p className="text-sm text-muted-foreground">
                  Your genetic markers indicate brown eyes, straight hair, lactose tolerance, and a tendency toward
                  being a "night owl" in sleep patterns. You're likely a slow metabolizer of caffeine.
                </p>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
                <Button variant="outline" size="sm">
                  <Share2 className="mr-2 h-4 w-4" />
                  Share Report
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ancestry" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ancestry Composition</CardTitle>
              <CardDescription>Your DNA indicates ancestry from the following regions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative h-[300px] w-full bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden mb-4">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <img
                      src="/placeholder.svg?height=300&width=500"
                      alt="World Map"
                      className="w-full h-full object-cover opacity-50"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">
                        Interactive ancestry map visualization would appear here
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    { region: "East Asian", percentage: 45, color: "bg-blue-500" },
                    { region: "European", percentage: 30, color: "bg-green-500" },
                    { region: "South Asian", percentage: 15, color: "bg-yellow-500" },
                    { region: "African", percentage: 10, color: "bg-red-500" },
                  ].map((ancestry) => (
                    <div key={ancestry.region}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">{ancestry.region}</span>
                        <span className="text-sm">{ancestry.percentage}%</span>
                      </div>
                      <div className="w-full h-2 bg-secondary rounded-full">
                        <div
                          className={`h-2 rounded-full ${ancestry.color}`}
                          style={{ width: `${ancestry.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>

                <Button className="w-full" asChild>
                  <Link href="/analysis/ancestry">View Detailed Ancestry Analysis</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Health Risk Summary</CardTitle>
              <CardDescription>Genetic variants associated with health conditions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: "Type 2 Diabetes", risk: "Average", level: 50 },
                  { name: "Coronary Heart Disease", risk: "Slightly Elevated", level: 65 },
                  { name: "Alzheimer's Disease", risk: "Reduced", level: 30 },
                  { name: "Macular Degeneration", risk: "Elevated", level: 75 },
                  { name: "Celiac Disease", risk: "Average", level: 45 },
                ].map((risk) => (
                  <div key={risk.name} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{risk.name}</span>
                      <span className="text-sm">{risk.risk}</span>
                    </div>
                    <div className="w-full h-2 bg-secondary rounded-full">
                      <div
                        className={`h-2 rounded-full ${
                          risk.level >= 70
                            ? "bg-red-500"
                            : risk.level >= 60
                              ? "bg-yellow-500"
                              : risk.level <= 40
                                ? "bg-green-500"
                                : "bg-blue-500"
                        }`}
                        style={{ width: `${risk.level}%` }}
                      ></div>
                    </div>
                  </div>
                ))}

                <Button className="w-full" asChild>
                  <Link href="/analysis/health">View Detailed Health Analysis</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="traits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Trait Highlights</CardTitle>
              <CardDescription>Notable genetic traits based on your DNA</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    name: "Eye Color",
                    result: "Brown",
                    description: "You have genetic markers associated with brown eyes.",
                    confidence: "high",
                  },
                  {
                    name: "Caffeine Metabolism",
                    result: "Slow Metabolizer",
                    description: "You may be more sensitive to caffeine's effects.",
                    confidence: "medium",
                  },
                  {
                    name: "Sleep Patterns",
                    result: "Night Owl",
                    description: "Your genetic profile suggests you may naturally prefer staying up late.",
                    confidence: "high",
                  },
                  {
                    name: "Lactose Tolerance",
                    result: "Tolerant",
                    description: "You likely maintain the ability to digest lactose into adulthood.",
                    confidence: "high",
                  },
                  {
                    name: "Hair Type",
                    result: "Straight",
                    description: "Your genetic profile indicates straight hair texture.",
                    confidence: "high",
                  },
                  {
                    name: "Bitter Taste Perception",
                    result: "Taster",
                    description: "You can likely taste bitter compounds like PTC.",
                    confidence: "medium",
                  },
                ].map((trait) => (
                  <Card key={trait.name} className="border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{trait.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-semibold mb-1">{trait.result}</div>
                      <p className="text-xs text-muted-foreground mb-2">{trait.description}</p>
                      <div className="text-xs">
                        <span
                          className={`px-2 py-1 rounded-full ${
                            trait.confidence === "high"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : trait.confidence === "medium"
                                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                          }`}
                        >
                          {trait.confidence.charAt(0).toUpperCase() + trait.confidence.slice(1)} confidence
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="mt-4">
                <Button className="w-full" asChild>
                  <Link href="/analysis/traits">View All Traits</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="raw-data" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Raw Genetic Data</CardTitle>
              <CardDescription>Access and export your raw SNP data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col space-y-1">
                    <span className="text-sm text-muted-foreground">Total SNPs</span>
                    <span className="text-2xl font-bold">635,287</span>
                  </div>
                  <div className="flex flex-col space-y-1">
                    <span className="text-sm text-muted-foreground">File Format</span>
                    <span className="text-2xl font-bold">23andMe v4</span>
                  </div>
                  <div className="flex flex-col space-y-1">
                    <span className="text-sm text-muted-foreground">Upload Date</span>
                    <span className="text-2xl font-bold">May 15, 2023</span>
                  </div>
                </div>

                <div className="rounded-md border">
                  <div className="p-4">
                    <h3 className="font-medium mb-2">Sample Data Preview</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-border">
                        <thead>
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">rsID</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                              Chromosome
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Position</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Genotype</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {[
                            { rsid: "rs4477212", chromosome: "1", position: "82154", genotype: "AA" },
                            { rsid: "rs3094315", chromosome: "1", position: "752566", genotype: "AG" },
                            { rsid: "rs3131972", chromosome: "1", position: "752721", genotype: "GG" },
                            { rsid: "rs12124819", chromosome: "1", position: "776546", genotype: "AA" },
                            { rsid: "rs11240777", chromosome: "1", position: "798959", genotype: "GG" },
                          ].map((snp, index) => (
                            <tr key={index}>
                              <td className="px-4 py-2 text-sm">{snp.rsid}</td>
                              <td className="px-4 py-2 text-sm">{snp.chromosome}</td>
                              <td className="px-4 py-2 text-sm">{snp.position}</td>
                              <td className="px-4 py-2 text-sm">{snp.genotype}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 justify-end">
                  <Button variant="outline" asChild>
                    <Link href="/analysis/raw-data">
                      <Eye className="mr-2 h-4 w-4" />
                      Browse Raw Data
                    </Link>
                  </Button>
                  <Button>
                    <Download className="mr-2 h-4 w-4" />
                    Export Raw Data
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

