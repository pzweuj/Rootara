"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react"
import { Progress } from "@/components/ui/progress"

export function DataUploadCard() {
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "success" | "error">("idle")
  const [progress, setProgress] = useState(0)
  const [fileName, setFileName] = useState("")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFileName(e.target.files[0].name)
    }
  }

  const simulateUpload = () => {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-medium">Upload Genetic Data</CardTitle>
      </CardHeader>
      <CardContent>
        {uploadState === "idle" && (
          <div className="space-y-4">
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
              />
              <label htmlFor="file-upload">
                <Button variant="outline" className="mx-auto" as="span">
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
                <Button size="sm" onClick={simulateUpload}>
                  Upload
                </Button>
              </div>
            )}
          </div>
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
              <Button>View Analysis Progress</Button>
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
    </Card>
  )
}
