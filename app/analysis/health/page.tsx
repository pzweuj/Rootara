"use client"

import React from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { AlertCircle, AlertTriangle, CheckCircle, Info, ExternalLink } from "lucide-react"
import { HealthRiskSummary } from "@/components/health-risk-summary"
import { useLanguage } from "@/contexts/language-context"

export default function HealthRisksPage() {
  const { language } = useLanguage()
  
  // 中英文文本映射
  const texts = {
    title: {
      en: "Health Risks",
      zh: "健康风险"
    },
    subtitle: {
      en: "Explore your genetic health predispositions",
      zh: "探索您的基因健康倾向"
    },
    notice: {
      title: {
        en: "Important Health Notice",
        zh: "重要健康提示"
      },
      content: {
        en: "Genetic testing is not a diagnostic tool. Always consult with a healthcare professional before making any medical decisions based on these results.",
        zh: "基因检测不是诊断工具。在根据这些结果做出任何医疗决定之前，请务必咨询医疗专业人士。"
      }
    },
    tabs: {
      overview: {
        en: "Overview",
        zh: "概览"
      },
      hereditary: {
        en: "Hereditary Diseases",
        zh: "遗传疾病"
      },
      drugs: {
        en: "Drug Responses",
        zh: "药物反应"
      },
      carrier: {
        en: "Carrier Status",
        zh: "携带者状态"
      }
    },
    understanding: {
      title: {
        en: "Understanding Health Risks",
        zh: "了解健康风险"
      },
      description: {
        en: "Your genetic health risks are calculated based on specific genetic variants associated with various conditions.",
        zh: "您的基因健康风险是根据与各种疾病相关的特定基因变异计算的。"
      },
      risks: {
        elevated: {
          en: "Elevated Risk",
          zh: "风险升高"
        },
        slightlyElevated: {
          en: "Slightly Elevated Risk",
          zh: "略微升高风险"
        },
        average: {
          en: "Average Risk",
          zh: "平均风险"
        },
        reduced: {
          en: "Reduced Risk",
          zh: "风险降低"
        }
      }
    },
    hereditary: {
      title: {
        en: "Hereditary Disease Risk Factors",
        zh: "遗传疾病风险因素"
      },
      description: {
        en: "Genetic variants associated with hereditary conditions",
        zh: "与遗传性疾病相关的基因变异"
      },
      geneticVariants: {
        en: "Genetic Variants:",
        zh: "基因变异:"
      },
      gene: {
        en: "Gene",
        zh: "基因"
      },
      variant: {
        en: "Variant",
        zh: "变异"
      },
      genotype: {
        en: "Your Genotype",
        zh: "您的基因型"
      },
      risk: {
        en: "Risk",
        zh: "风险"
      }
    },
    drugs: {
      title: {
        en: "Drug Response Genetics",
        zh: "药物反应基因学"
      },
      description: {
        en: "How your genetics may affect your response to medications",
        zh: "您的基因如何影响您对药物的反应"
      },
      relevantGenes: {
        en: "Relevant Genes:",
        zh: "相关基因:"
      }
    },
    carrier: {
      title: {
        en: "Carrier Status",
        zh: "携带者状态"
      },
      description: {
        en: "Genetic variants that could be passed to your children",
        zh: "可能传递给您子女的基因变异"
      },
      gene: {
        en: "Gene:",
        zh: "基因:"
      },
      variants: {
        en: "Variants:",
        zh: "变异:"
      }
    },
    learnMore: {
      en: "Learn More",
      zh: "了解更多"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{texts.title[language === "en" ? "en" : "zh"]}</h1>
          <p className="text-muted-foreground">{texts.subtitle[language === "en" ? "en" : "zh"]}</p>
        </div>
      </div>

      <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
        <CardContent className="flex items-start space-x-4 py-4">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800 dark:text-yellow-300">
              {texts.notice.title[language === "en" ? "en" : "zh"]}
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              {texts.notice.content[language === "en" ? "en" : "zh"]}
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{texts.tabs.overview[language === "en" ? "en" : "zh"]}</TabsTrigger>
          <TabsTrigger value="hereditary">{texts.tabs.hereditary[language === "en" ? "en" : "zh"]}</TabsTrigger>
          <TabsTrigger value="drugs">{texts.tabs.drugs[language === "en" ? "en" : "zh"]}</TabsTrigger>
          <TabsTrigger value="carrier">{texts.tabs.carrier[language === "en" ? "en" : "zh"]}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <HealthRiskSummary />
            </div>
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{texts.understanding.title[language === "en" ? "en" : "zh"]}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {texts.understanding.description[language === "en" ? "en" : "zh"]}
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm">{texts.understanding.risks.elevated[language === "en" ? "en" : "zh"]}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm">{texts.understanding.risks.slightlyElevated[language === "en" ? "en" : "zh"]}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Info className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">{texts.understanding.risks.average[language === "en" ? "en" : "zh"]}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">{texts.understanding.risks.reduced[language === "en" ? "en" : "zh"]}</span>
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
              <CardTitle>{texts.hereditary.title[language === "en" ? "en" : "zh"]}</CardTitle>
              <CardDescription>{texts.hereditary.description[language === "en" ? "en" : "zh"]}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[
                  {
                    name: "Type 2 Diabetes",
                    nameZh: "2型糖尿病",
                    risk: "Average",
                    riskZh: "平均",
                    icon: Info,
                    iconColor: "text-blue-500",
                    variants: [
                      { gene: "TCF7L2", variant: "rs7903146", status: "TT" },
                      { gene: "KCNJ11", variant: "rs5219", status: "CT" },
                    ],
                    description: "Your genetic risk for Type 2 Diabetes is similar to the average population.",
                    descriptionZh: "您的2型糖尿病基因风险与平均人群相似。"
                  },
                  {
                    name: "Coronary Heart Disease",
                    nameZh: "冠心病",
                    risk: "Slightly Elevated",
                    riskZh: "略微升高",
                    icon: AlertTriangle,
                    iconColor: "text-yellow-500",
                    variants: [
                      { gene: "9p21", variant: "rs10757278", status: "GG" },
                      { gene: "PCSK9", variant: "rs11591147", status: "GT" },
                    ],
                    description: "You have some genetic variants that may slightly increase your risk for coronary heart disease.",
                    descriptionZh: "您有一些可能略微增加冠心病风险的基因变异。"
                  },
                  {
                    name: "Alzheimer's Disease",
                    nameZh: "阿尔茨海默病",
                    risk: "Reduced",
                    riskZh: "降低",
                    icon: CheckCircle,
                    iconColor: "text-green-500",
                    variants: [
                      { gene: "APOE", variant: "rs429358", status: "TT" },
                      { gene: "APOE", variant: "rs7412", status: "CT" },
                    ],
                    description: "Your genetic profile suggests a reduced risk for late-onset Alzheimer's Disease.",
                    descriptionZh: "您的基因特征表明晚发性阿尔茨海默病的风险降低。"
                  },
                ].map((condition) => (
                  <div key={condition.name} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <condition.icon className={`h-5 w-5 ${condition.iconColor} mr-2`} />
                        <h3 className="text-lg font-medium">
                          {language === "en" ? condition.name : condition.nameZh}
                        </h3>
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
                        {language === "en" ? condition.risk : condition.riskZh} {language === "en" ? "Risk" : "风险"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      {language === "en" ? condition.description : condition.descriptionZh}
                    </p>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">{texts.hereditary.geneticVariants[language === "en" ? "en" : "zh"]}</div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="font-medium">{texts.hereditary.gene[language === "en" ? "en" : "zh"]}</div>
                        <div className="font-medium">{texts.hereditary.variant[language === "en" ? "en" : "zh"]}</div>
                        <div className="font-medium">{texts.hereditary.genotype[language === "en" ? "en" : "zh"]}</div>
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
                        {texts.learnMore[language === "en" ? "en" : "zh"]}
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
              <CardTitle>{texts.drugs.title[language === "en" ? "en" : "zh"]}</CardTitle>
              <CardDescription>{texts.drugs.description[language === "en" ? "en" : "zh"]}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[
                  {
                    drug: "Warfarin",
                    drugZh: "华法林",
                    response: "Increased Sensitivity",
                    responseZh: "敏感性增加",
                    icon: AlertTriangle,
                    iconColor: "text-yellow-500",
                    genes: ["CYP2C9", "VKORC1"],
                    description: "You may be more sensitive to warfarin and might require a lower dose.",
                    descriptionZh: "您可能对华法林更敏感，可能需要较低剂量。"
                  },
                  {
                    drug: "Clopidogrel (Plavix)",
                    drugZh: "氯吡格雷 (波立维)",
                    response: "Reduced Response",
                    responseZh: "反应降低",
                    icon: AlertCircle,
                    iconColor: "text-red-500",
                    genes: ["CYP2C19"],
                    description: "You may have reduced response to clopidogrel due to your CYP2C19 genotype.",
                    descriptionZh: "由于您的CYP2C19基因型，您对氯吡格雷的反应可能降低。"
                  },
                  {
                    drug: "Simvastatin",
                    drugZh: "辛伐他汀",
                    response: "Normal Response",
                    responseZh: "正常反应",
                    icon: CheckCircle,
                    iconColor: "text-green-500",
                    genes: ["SLCO1B1"],
                    description: "You are likely to have a normal response to simvastatin.",
                    descriptionZh: "您可能对辛伐他汀有正常反应。"
                  },
                ].map((drug) => (
                  <div key={drug.drug} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <drug.icon className={`h-5 w-5 ${drug.iconColor} mr-2`} />
                        <h3 className="text-lg font-medium">{language === "en" ? drug.drug : drug.drugZh}</h3>
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
                        {language === "en" ? drug.response : drug.responseZh}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      {language === "en" ? drug.description : drug.descriptionZh}
                    </p>
                    <div className="text-sm">
                      <span className="font-medium">{texts.drugs.relevantGenes[language === "en" ? "en" : "zh"]}</span> {drug.genes.join(", ")}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button variant="outline" size="sm">
                        <ExternalLink className="mr-2 h-3 w-3" />
                        {texts.learnMore[language === "en" ? "en" : "zh"]}
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
              <CardTitle>{texts.carrier.title[language === "en" ? "en" : "zh"]}</CardTitle>
              <CardDescription>{texts.carrier.description[language === "en" ? "en" : "zh"]}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[
                  {
                    condition: "Cystic Fibrosis",
                    conditionZh: "囊性纤维化",
                    status: "Not a Carrier",
                    statusZh: "非携带者",
                    icon: CheckCircle,
                    iconColor: "text-green-500",
                    gene: "CFTR",
                    variants: "0 variants detected",
                    variantsZh: "未检测到变异",
                    description: "No variants associated with Cystic Fibrosis were detected in your genome.",
                    descriptionZh: "在您的基因组中未检测到与囊性纤维化相关的变异。"
                  },
                  {
                    condition: "Sickle Cell Anemia",
                    conditionZh: "镰状细胞贫血",
                    status: "Not a Carrier",
                    statusZh: "非携带者",
                    icon: CheckCircle,
                    iconColor: "text-green-500",
                    gene: "HBB",
                    variants: "0 variants detected",
                    variantsZh: "未检测到变异",
                    description: "No variants associated with Sickle Cell Anemia were detected in your genome.",
                    descriptionZh: "在您的基因组中未检测到与镰状细胞贫血相关的变异。"
                  },
                  {
                    condition: "Tay-Sachs Disease",
                    conditionZh: "泰-萨克斯病",
                    status: "Carrier",
                    statusZh: "携带者",
                    icon: AlertCircle,
                    iconColor: "text-yellow-500",
                    gene: "HEXA",
                    variants: "1 variant detected",
                    variantsZh: "检测到1个变异",
                    description: "You are a carrier for one variant associated with Tay-Sachs Disease. This means you have one copy of a genetic variant that can cause this condition. If your partner is also a carrier, there is a 25% chance your child could inherit the condition.",
                    descriptionZh: "您是泰-萨克斯病相关变异的携带者。这意味着您有一个可能导致该疾病的基因变异副本。如果您的伴侣也是携带者，您的孩子有25%的几率继承该疾病。"
                  },
                ].map((condition) => (
                  <div key={condition.condition} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <condition.icon className={`h-5 w-5 ${condition.iconColor} mr-2`} />
                        <h3 className="text-lg font-medium">{language === "en" ? condition.condition : condition.conditionZh}</h3>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          condition.status === "Carrier"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                            : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        }`}
                      >
                        {language === "en" ? condition.status : condition.statusZh}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      {language === "en" ? condition.description : condition.descriptionZh}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="font-medium">{texts.carrier.gene[language === "en" ? "en" : "zh"]}</span> {condition.gene}
                      </div>
                      <div>
                        <span className="font-medium">{texts.carrier.variants[language === "en" ? "en" : "zh"]}</span> {language === "en" ? condition.variants : condition.variantsZh}
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button variant="outline" size="sm">
                        <ExternalLink className="mr-2 h-3 w-3" />
                        {texts.learnMore[language === "en" ? "en" : "zh"]}
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

