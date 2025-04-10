import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Copy } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLanguage } from "@/contexts/language-context"

// 为不同报告定义不同的示例数据
const reportData = {
  "RPT-5K9L2M": [
    { rsid: "rs4477212", chromosome: "1", position: "82154", genotype: "AA" },
    { rsid: "rs3094315", chromosome: "1", position: "752566", genotype: "AG" },
    { rsid: "rs3131972", chromosome: "1", position: "752721", genotype: "GG" },
    { rsid: "rs12124819", chromosome: "1", position: "776546", genotype: "AA" },
    { rsid: "rs11240777", chromosome: "1", position: "798959", genotype: "GG" },
  ],
  "RPT-6L9M3N": [
    { rsid: "rs6681049", chromosome: "1", position: "800007", genotype: "CT" },
    { rsid: "rs4970383", chromosome: "1", position: "838555", genotype: "CC" },
    { rsid: "rs4475691", chromosome: "1", position: "846808", genotype: "CT" },
    { rsid: "rs7537756", chromosome: "1", position: "854250", genotype: "AG" },
    { rsid: "rs13302982", chromosome: "1", position: "861808", genotype: "GG" },
  ],
  // 可以添加更多报告的数据
}

// 为不同报告定义不同的元数据
const reportMetadata = {
  "RPT-5K9L2M": {
    totalSNPs: "635,287",
    fileFormat: "23andMe v4",
    uploadDate: "2023年5月15日",
  },
  "RPT-6L9M3N": {
    totalSNPs: "548,123",
    fileFormat: "AncestryDNA v2",
    uploadDate: "2023年6月20日",
  },
  // 可以添加更多报告的元数据
}

interface RawGeneticDataProps {
  currentReportId: string;
}

export function RawGeneticData({ currentReportId }: RawGeneticDataProps) {
  const { t, language } = useLanguage()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedChromosome, setSelectedChromosome] = useState("all")
  const [snpData, setSnpData] = useState(reportData[currentReportId as keyof typeof reportData] || [])
  const [metadata, setMetadata] = useState(reportMetadata[currentReportId as keyof typeof reportMetadata] || {})

  // 当报告ID变化时更新数据
  useEffect(() => {
    setSnpData(reportData[currentReportId as keyof typeof reportData] || [])
    setMetadata(reportMetadata[currentReportId as keyof typeof reportMetadata] || {})
    setSearchQuery("") // 重置搜索
    setSelectedChromosome("all") // 重置染色体筛选
  }, [currentReportId])

  const filteredData = snpData.filter((snp) => {
    const matchesSearch = snp.rsid.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesChromosome = selectedChromosome === "all" || snp.chromosome === selectedChromosome
    return matchesSearch && matchesChromosome
  })

  const chromosomes = Array.from(new Set(snpData.map((snp) => snp.chromosome))).sort(
    (a, b) => Number.parseInt(a) - Number.parseInt(b),
  )

  const handleCopyRsid = (rsid: string) => {
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
    <div className="mt-8">
      <h2 className="text-2xl font-bold tracking-tight mb-4">{t("rawData") || "原始基因数据"}</h2>
      
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-medium">
            {currentReportId}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col space-y-1">
              <span className="text-sm text-muted-foreground">{t("totalSnps")}</span>
              <span className="text-2xl font-bold">{metadata.totalSNPs}</span>
            </div>
            <div className="flex flex-col space-y-1">
              <span className="text-sm text-muted-foreground">{t("fileFormat")}</span>
              <span className="text-2xl font-bold">{metadata.fileFormat}</span>
            </div>
            <div className="flex flex-col space-y-1">
              <span className="text-sm text-muted-foreground">{t("uploadDate")}</span>
              <span className="text-2xl font-bold">{metadata.uploadDate}</span>
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
        <div className="w-full md:w-1/3">
          <Select value={selectedChromosome} onValueChange={setSelectedChromosome}>
            <SelectTrigger>
              <SelectValue placeholder={t("chromosome") || "染色体"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allChromosomes") || "所有染色体"}</SelectItem>
              {chromosomes.map((chr) => (
                <SelectItem key={chr as string} value={chr as string}>
                  {`${t("chromosome") || "染色体"} ${chr}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                {filteredData.length > 0 ? (
                  filteredData.map((snp: { rsid: string; chromosome: string; position: string; genotype: string }) => (
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
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4">
                      {t("noDataFound") || "未找到匹配的数据"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center mt-4">
        <p className="text-sm text-muted-foreground">
          {t("showing") || "显示"} {filteredData.length} {t("of") || "/"} {snpData.length} SNPs
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
    </div>
  )
}