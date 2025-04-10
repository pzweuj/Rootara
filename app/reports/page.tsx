"use client"

import { useState } from "react"
import { ReportSwitcher } from "@/components/report-switcher"
import { useLanguage } from "@/contexts/language-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, Search, Filter, FileDown, Database, Copy } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Sample SNP data
const sampleSnpData = [
  { rsid: "rs4477212", chromosome: "1", position: "82154", genotype: "AA" },
  { rsid: "rs3094315", chromosome: "1", position: "752566", genotype: "AG" },
  { rsid: "rs3131972", chromosome: "1", position: "752721", genotype: "GG" },
  { rsid: "rs12124819", chromosome: "1", position: "776546", genotype: "AA" },
  { rsid: "rs11240777", chromosome: "1", position: "798959", genotype: "GG" },
  // ... 其他数据省略
]

export default function ReportsPage() {
  const { t } = useLanguage()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedChromosome, setSelectedChromosome] = useState("all")
  const [exportFormat, setExportFormat] = useState("csv")

  const filteredData = sampleSnpData.filter((snp) => {
    const matchesSearch = snp.rsid.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesChromosome = selectedChromosome === "all" || snp.chromosome === selectedChromosome
    return matchesSearch && matchesChromosome
  })

  const chromosomes = Array.from(new Set(sampleSnpData.map((snp) => snp.chromosome))).sort(
    (a, b) => Number.parseInt(a) - Number.parseInt(b),
  )

  const handleExport = () => {
    console.log(`Exporting data in ${exportFormat} format`)
  }

  const handleCopyRsid = (rsid) => {
    navigator.clipboard
      .writeText(rsid)
      .then(() => {
        console.log(`Copied ${rsid} to clipboard`)
      })
      .catch((err) => {
        console.error("Failed to copy: ", err)
      })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">{t("myReports")}</h1>
        <div className="flex gap-2">
          <Select value={exportFormat} onValueChange={setExportFormat}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder={t("format") || "格式"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="txt">TXT</SelectItem>
              <SelectItem value="vcf">VCF</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleExport}>
            <FileDown className="mr-2 h-4 w-4" />
            {t("export") || "导出"}
          </Button>
        </div>
      </div>

      {/* 设置 WeGene 报告为默认报告 */}
      <ReportSwitcher defaultReportId="RPT-5K9L2M" />

      <div className="mt-8">
        <h2 className="text-2xl font-bold tracking-tight mb-4">{t("rawGeneticData") || "原始基因数据"}</h2>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("dataSummary") || "数据摘要"}</CardTitle>
            <CardDescription>{t("dataOverview") || "您的基因数据文件概览"}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col space-y-1">
                <span className="text-sm text-muted-foreground">{t("totalSNPs") || "SNP总数"}</span>
                <span className="text-2xl font-bold">635,287</span>
              </div>
              <div className="flex flex-col space-y-1">
                <span className="text-sm text-muted-foreground">{t("fileFormat") || "文件格式"}</span>
                <span className="text-2xl font-bold">23andMe v4</span>
              </div>
              <div className="flex flex-col space-y-1">
                <span className="text-sm text-muted-foreground">{t("uploadDate") || "上传日期"}</span>
                <span className="text-2xl font-bold">2023年5月15日</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative w-full md:w-2/3">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("searchByRsID") || "按rsID搜索..."}
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="w-full md:w-1/3 flex gap-2">
            <Select value={selectedChromosome} onValueChange={setSelectedChromosome}>
              <SelectTrigger>
                <SelectValue placeholder={t("chromosome") || "染色体"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allChromosomes") || "所有染色体"}</SelectItem>
                {chromosomes.map((chr) => (
                  <SelectItem key={chr} value={chr}>
                    {t("chromosome") || "染色体"} {chr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              {t("moreFilters") || "更多筛选"}
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>rsID</TableHead>
                    <TableHead>{t("chromosome") || "染色体"}</TableHead>
                    <TableHead>{t("position") || "位置"}</TableHead>
                    <TableHead>{t("genotype") || "基因型"}</TableHead>
                    <TableHead className="w-[100px]">{t("actions") || "操作"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((snp) => (
                    <TableRow key={snp.rsid}>
                      <TableCell className="font-medium">{snp.rsid}</TableCell>
                      <TableCell>{snp.chromosome}</TableCell>
                      <TableCell>{snp.position}</TableCell>
                      <TableCell>{snp.genotype}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleCopyRsid(snp.rsid)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center mt-4">
          <p className="text-sm text-muted-foreground">
            {t("showing") || "显示"} {filteredData.length} {t("of") || "/"} {sampleSnpData.length} SNPs
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              {t("previous") || "上一页"}
            </Button>
            <Button variant="outline" size="sm">
              {t("next") || "下一页"}
            </Button>
          </div>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="mr-2 h-5 w-5" />
              {t("thirdPartyTools") || "第三方分析工具"}
            </CardTitle>
            <CardDescription>{t("exportForOtherServices") || "导出您的数据用于其他基因分析服务"}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { name: "Promethease", description: t("prometheaseDesc") || "基因报告文献检索系统" },
                { name: "Codegen", description: t("codegenDesc") || "分析健康状况和特征" },
                { name: "GEDmatch", description: t("gedmatchDesc") || "DNA和家谱分析工具" },
              ].map((tool) => (
                <Card key={tool.name}>
                  <CardContent className="p-4">
                    <h3 className="font-medium mb-1">{tool.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{tool.description}</p>
                    <Button variant="outline" size="sm" className="w-full">
                      <Download className="mr-2 h-3 w-3" />
                      {t("exportFor") || "导出到"} {tool.name}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

