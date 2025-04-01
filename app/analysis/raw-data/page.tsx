"use client"

import { useState } from "react"
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
  { rsid: "rs6681049", chromosome: "1", position: "800007", genotype: "CT" },
  { rsid: "rs4970383", chromosome: "1", position: "838555", genotype: "CC" },
  { rsid: "rs4475691", chromosome: "1", position: "846808", genotype: "CT" },
  { rsid: "rs7537756", chromosome: "1", position: "854250", genotype: "AG" },
  { rsid: "rs13302982", chromosome: "1", position: "861808", genotype: "GG" },
  { rsid: "rs1110052", chromosome: "2", position: "734462", genotype: "GT" },
  { rsid: "rs2073813", chromosome: "2", position: "882815", genotype: "CC" },
  { rsid: "rs2073812", chromosome: "3", position: "886234", genotype: "GG" },
  { rsid: "rs10910078", chromosome: "3", position: "888659", genotype: "CT" },
  { rsid: "rs10910092", chromosome: "4", position: "889238", genotype: "GG" },
  { rsid: "rs10910094", chromosome: "5", position: "889241", genotype: "AA" },
  { rsid: "rs10493116", chromosome: "6", position: "889711", genotype: "CC" },
  { rsid: "rs9442372", chromosome: "7", position: "893379", genotype: "AA" },
  { rsid: "rs10494225", chromosome: "8", position: "894573", genotype: "CT" },
  { rsid: "rs1008762", chromosome: "9", position: "894584", genotype: "GG" },
]

export default function RawDataPage() {
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
    // In a real app, this would generate and download the file
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Raw Genetic Data</h1>
          <p className="text-muted-foreground">Access and export your raw SNP data</p>
        </div>
        <div className="flex gap-2">
          <Select value={exportFormat} onValueChange={setExportFormat}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="txt">TXT</SelectItem>
              <SelectItem value="vcf">VCF</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleExport}>
            <FileDown className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Data Summary</CardTitle>
          <CardDescription>Overview of your genetic data file</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative w-full md:w-2/3">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by rsID..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="w-full md:w-1/3 flex gap-2">
          <Select value={selectedChromosome} onValueChange={setSelectedChromosome}>
            <SelectTrigger>
              <SelectValue placeholder="Chromosome" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Chromosomes</SelectItem>
              {chromosomes.map((chr) => (
                <SelectItem key={chr} value={chr}>
                  Chromosome {chr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            More Filters
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
                  <TableHead>Chromosome</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Genotype</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
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

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Showing {filteredData.length} of {sampleSnpData.length} SNPs
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            Previous
          </Button>
          <Button variant="outline" size="sm">
            Next
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="mr-2 h-5 w-5" />
            Third-Party Analysis Tools
          </CardTitle>
          <CardDescription>Export your data for use with other genetic analysis services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: "Promethease", description: "Literature retrieval system for genetic reports" },
              { name: "Codegen", description: "Analyze health conditions and traits" },
              { name: "GEDmatch", description: "DNA and genealogical analysis tool" },
            ].map((tool) => (
              <Card key={tool.name}>
                <CardContent className="p-4">
                  <h3 className="font-medium mb-1">{tool.name}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{tool.description}</p>
                  <Button variant="outline" size="sm" className="w-full">
                    <Download className="mr-2 h-3 w-3" />
                    Export for {tool.name}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

