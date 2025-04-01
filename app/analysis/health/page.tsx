"use client"

import React from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { AlertCircle, AlertTriangle, CheckCircle, Info, Download, Share2, ExternalLink } from "lucide-react"
import { HealthRiskSummary } from "@/components/health-risk-summary"

export default function HealthRisksPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Health Risks</h1>
          <p className="text-muted-foreground">Explore your genetic health predispositions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
          <Button variant="outline">
            <Share2 className="mr-2 h-4 w-4" />
            Share With Doctor
          </Button>
        </div>
      </div>

      <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
        <CardContent className="flex items-start space-x-4 py-4">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800 dark:text-yellow-300">Important Health Notice</p>
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Genetic testing is not a diagnostic tool. Always consult with a healthcare professional before making any
              medical decisions based on these results.
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="hereditary">Hereditary Diseases</TabsTrigger>
          <TabsTrigger value="drugs">Drug Responses</TabsTrigger>
          <TabsTrigger value="carrier">Carrier Status</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <HealthRiskSummary />
            </div>
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Understanding Health Risks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Your genetic health risks are calculated based on specific genetic variants associated with various
                    conditions.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm">Elevated Risk</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm">Slightly Elevated Risk</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Info className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">Average Risk</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Reduced Risk</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="hereditary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Hereditary Disease Risk Factors</CardTitle>
              <CardDescription>Genetic variants associated with hereditary conditions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[
                  {
                    name: "Type 2 Diabetes",
                    risk: "Average",
                    icon: Info,
                    iconColor: "text-blue-500",
                    variants: [
                      { gene: "TCF7L2", variant: "rs7903146", status: "TT" },
                      { gene: "KCNJ11", variant: "rs5219", status: "CT" },
                    ],
                    description: "Your genetic risk for Type 2 Diabetes is similar to the average population.",
                  },
                  {
                    name: "Coronary Heart Disease",
                    risk: "Slightly Elevated",
                    icon: AlertTriangle,
                    iconColor: "text-yellow-500",
                    variants: [
                      { gene: "9p21", variant: "rs10757278", status: "GG" },
                      { gene: "PCSK9", variant: "rs11591147", status: "GT" },
                    ],
                    description:
                      "You have some genetic variants that may slightly increase your risk for coronary heart disease.",
                  },
                  {
                    name: "Alzheimer's Disease",
                    risk: "Reduced",
                    icon: CheckCircle,
                    iconColor: "text-green-500",
                    variants: [
                      { gene: "APOE", variant: "rs429358", status: "TT" },
                      { gene: "APOE", variant: "rs7412", status: "CT" },
                    ],
                    description: "Your genetic profile suggests a reduced risk for late-onset Alzheimer's Disease.",
                  },
                ].map((condition) => (
                  <div key={condition.name} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <condition.icon className={`h-5 w-5 ${condition.iconColor} mr-2`} />
                        <h3 className="text-lg font-medium">{condition.name}</h3>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          condition.risk === "Elevated"
                            ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            : condition.risk === "Slightly Elevated"
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                              : condition.risk === "Reduced"
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                        }`}
                      >
                        {condition.risk} Risk
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">{condition.description}</p>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Genetic Variants:</div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="font-medium">Gene</div>
                        <div className="font-medium">Variant</div>
                        <div className="font-medium">Your Genotype</div>
                        {condition.variants.map((variant, index) => (
                          <React.Fragment key={index}>
                            <div>{variant.gene}</div>
                            <div>{variant.variant}</div>
                            <div>{variant.status}</div>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button variant="outline" size="sm">
                        <ExternalLink className="mr-2 h-3 w-3" />
                        Learn More
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drugs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Drug Response Genetics</CardTitle>
              <CardDescription>How your genetics may affect your response to medications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[
                  {
                    drug: "Warfarin",
                    response: "Increased Sensitivity",
                    icon: AlertTriangle,
                    iconColor: "text-yellow-500",
                    genes: ["CYP2C9", "VKORC1"],
                    description: "You may be more sensitive to warfarin and might require a lower dose.",
                  },
                  {
                    drug: "Clopidogrel (Plavix)",
                    response: "Reduced Response",
                    icon: AlertCircle,
                    iconColor: "text-red-500",
                    genes: ["CYP2C19"],
                    description: "You may have reduced response to clopidogrel due to your CYP2C19 genotype.",
                  },
                  {
                    drug: "Simvastatin",
                    response: "Normal Response",
                    icon: CheckCircle,
                    iconColor: "text-green-500",
                    genes: ["SLCO1B1"],
                    description: "You are likely to have a normal response to simvastatin.",
                  },
                ].map((drug) => (
                  <div key={drug.drug} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <drug.icon className={`h-5 w-5 ${drug.iconColor} mr-2`} />
                        <h3 className="text-lg font-medium">{drug.drug}</h3>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          drug.response === "Reduced Response"
                            ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            : drug.response === "Increased Sensitivity"
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                              : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        }`}
                      >
                        {drug.response}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">{drug.description}</p>
                    <div className="text-sm">
                      <span className="font-medium">Relevant Genes:</span> {drug.genes.join(", ")}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button variant="outline" size="sm">
                        <ExternalLink className="mr-2 h-3 w-3" />
                        Learn More
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="carrier" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Carrier Status</CardTitle>
              <CardDescription>Genetic variants that could be passed to your children</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[
                  {
                    condition: "Cystic Fibrosis",
                    status: "Not a Carrier",
                    icon: CheckCircle,
                    iconColor: "text-green-500",
                    gene: "CFTR",
                    variants: "0 variants detected",
                    description: "No variants associated with Cystic Fibrosis were detected in your genome.",
                  },
                  {
                    condition: "Sickle Cell Anemia",
                    status: "Not a Carrier",
                    icon: CheckCircle,
                    iconColor: "text-green-500",
                    gene: "HBB",
                    variants: "0 variants detected",
                    description: "No variants associated with Sickle Cell Anemia were detected in your genome.",
                  },
                  {
                    condition: "Tay-Sachs Disease",
                    status: "Carrier",
                    icon: AlertCircle,
                    iconColor: "text-yellow-500",
                    gene: "HEXA",
                    variants: "1 variant detected",
                    description:
                      "You are a carrier for one variant associated with Tay-Sachs Disease. This means you have one copy of a genetic variant that can cause this condition. If your partner is also a carrier, there is a 25% chance your child could inherit the condition.",
                  },
                ].map((condition) => (
                  <div key={condition.condition} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <condition.icon className={`h-5 w-5 ${condition.iconColor} mr-2`} />
                        <h3 className="text-lg font-medium">{condition.condition}</h3>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          condition.status === "Carrier"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                            : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        }`}
                      >
                        {condition.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">{condition.description}</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="font-medium">Gene:</span> {condition.gene}
                      </div>
                      <div>
                        <span className="font-medium">Variants:</span> {condition.variants}
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button variant="outline" size="sm">
                        <ExternalLink className="mr-2 h-3 w-3" />
                        Learn More
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

