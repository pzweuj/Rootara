"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Upload, FileText, CheckCircle, AlertCircle, Info } from "lucide-react"
import { useRouter } from "next/navigation"

export default function UploadReportPage() {
  const router = useRouter()
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "success" | "error">("idle")
  const [progress, setProgress] = useState(0)
  const [fileName, setFileName] = useState("")
  const [reportName, setReportName] = useState("")
  const [source, setSource] = useState("")
  const [isDefault, setIsDefault] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setFileName(file.name)

      // Auto-detect source based on file name (simplified example)
      if (file.name.toLowerCase().includes("23andme")) {
        setSource("23andMe")
      } else if (file.name.toLowerCase().includes("ancestry")) {
        setSource("AncestryDNA")
      } else if (file.name.toLowerCase().includes("myheritage")) {
        setSource("MyHeritage")
      } else if (file.name.toLowerCase().includes("ftdna") || file.name.toLowerCase().includes("familytree")) {
        setSource("FamilyTreeDNA")
      }

      // Auto-generate report name based on file name
      const baseName = file.name.split(".")[0].replace(/[_-]/g, " ")
      setReportName(baseName)
    }
  }

  const simulateUpload = () => {
    if (!fileName) {
      return
    }

    setUploadState("uploading")
    setProgress(0)

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setUploadState("success")
          return 100
        }
        return prev + 5
      })
    }, 200)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    simulateUpload()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Upload Genetic Data</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload New Report</CardTitle>
          <CardDescription>Upload your genetic data file from a testing service</CardDescription>
        </CardHeader>
        <CardContent>
          {uploadState === "idle" && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="report-name">Report Name</Label>
                <Input
                  id="report-name"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder="e.g., My Ancestry Analysis"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="source">Data Source</Label>
                <Select value={source} onValueChange={setSource} required>
                  <SelectTrigger id="source">
                    <SelectValue placeholder="Select data source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="23andMe">23andMe</SelectItem>
                    <SelectItem value="AncestryDNA">AncestryDNA</SelectItem>
                    <SelectItem value="MyHeritage">MyHeritage</SelectItem>
                    <SelectItem value="FamilyTreeDNA">FamilyTreeDNA</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drag and drop your genetic data file or click to browse
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  Supported formats: 23andMe, AncestryDNA, MyHeritage, FTDNA
                </p>
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept=".txt,.csv,.tsv"
                  onChange={handleFileChange}
                  required
                />
                <label htmlFor="file-upload">
                  <Button variant="outline" className="mx-auto" type="button" as="span">
                    Select File
                  </Button>
                </label>
              </div>

              {fileName && (
                <div className="flex items-center justify-between p-2 bg-secondary rounded-md">
                  <div className="flex items-center">
                    <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span className="text-sm truncate max-w-[200px]">{fileName}</span>
                  </div>
                  <Button size="sm" variant="ghost" type="button" onClick={() => setFileName("")}>
                    Remove
                  </Button>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox id="default" checked={isDefault} onCheckedChange={setIsDefault} />
                <Label htmlFor="default">Set as default report</Label>
              </div>

              <div className="flex items-center p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                <Info className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0" />
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Your genetic data is private and secure. We use industry-standard encryption to protect your
                  information.
                </p>
              </div>
            </form>
          )}

          {uploadState === "uploading" && (
            <div className="space-y-4">
              <div className="p-6 text-center">
                <p className="text-sm font-medium mb-4">Uploading your genetic data...</p>
                <Progress value={progress} className="h-2 mb-4" />
                <p className="text-xs text-muted-foreground">This may take a few minutes depending on file size</p>
              </div>
            </div>
          )}

          {uploadState === "success" && (
            <div className="space-y-4">
              <div className="p-6 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-2" />
                <p className="text-lg font-medium mb-2">Upload Complete!</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Your genetic data has been successfully uploaded and is now being processed.
                </p>
                <Button onClick={() => router.push("/reports")}>View My Reports</Button>
              </div>
            </div>
          )}

          {uploadState === "error" && (
            <div className="space-y-4">
              <div className="p-6 text-center">
                <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-2" />
                <p className="text-lg font-medium mb-2">Upload Failed</p>
                <p className="text-sm text-muted-foreground mb-4">
                  There was an error uploading your file. Please try again.
                </p>
                <Button variant="outline" onClick={() => setUploadState("idle")}>
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </CardContent>
        {uploadState === "idle" && (
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => router.push("/reports")}>
              Cancel
            </Button>
            <Button type="submit" onClick={handleSubmit} disabled={!fileName || !reportName || !source}>
              Upload Report
            </Button>
          </CardFooter>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Supported Data Formats</CardTitle>
          <CardDescription>Information about compatible genetic data formats</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-md p-4">
                <h3 className="font-medium mb-2">23andMe</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Raw data files from 23andMe are typically in a tab-separated format (.txt).
                </p>
                <p className="text-xs text-muted-foreground">
                  Download from 23andMe: Account → Browse Raw Data → Download
                </p>
              </div>

              <div className="border rounded-md p-4">
                <h3 className="font-medium mb-2">AncestryDNA</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  AncestryDNA provides raw data in a tab-separated format (.txt).
                </p>
                <p className="text-xs text-muted-foreground">
                  Download from Ancestry: DNA → Settings → Download Raw DNA Data
                </p>
              </div>

              <div className="border rounded-md p-4">
                <h3 className="font-medium mb-2">MyHeritage</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  MyHeritage DNA data is available in CSV format (.csv).
                </p>
                <p className="text-xs text-muted-foreground">
                  Download from MyHeritage: DNA → Manage DNA kits → Download
                </p>
              </div>

              <div className="border rounded-md p-4">
                <h3 className="font-medium mb-2">Family Tree DNA</h3>
                <p className="text-sm text-muted-foreground mb-2">FTDNA provides raw data in CSV format (.csv).</p>
                <p className="text-xs text-muted-foreground">Download from FTDNA: myDNA → Download Raw Data</p>
              </div>
            </div>

            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Important Note</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    Files must be uncompressed before uploading. If your file is in a .zip or .gz format, please extract
                    it first. Maximum file size is 50MB.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

