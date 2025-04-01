"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Share2, UserPlus, Users, Building, FileText, Trash2, Mail, Copy, Check, AlertTriangle } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const sharedUsers = [
  {
    id: 1,
    name: "Dr. Sarah Johnson",
    email: "sarah.johnson@example.com",
    type: "Healthcare Provider",
    access: "Full Access",
    date: "2023-06-15",
    avatar:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/375238645_11475210.jpg-lU8bOe6TLt5Rv51hgjg8NT8PsDBmvN.jpeg",
  },
  {
    id: 2,
    name: "Michael Chen",
    email: "michael.chen@example.com",
    type: "Family Member",
    access: "Limited Access",
    date: "2023-05-20",
    avatar:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/375238208_11475222.jpg-poEIzVHAGiIfMFQ7EiF8PUG1u0Zkzz.jpeg",
  },
  {
    id: 3,
    name: "Genomics Research Institute",
    email: "research@genomics.example.org",
    type: "Research Institution",
    access: "Anonymized Data",
    date: "2023-04-10",
    avatar: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/dd.jpg-4MCwPC2Bec6Ume26Yo1kao3CnONxDg.jpeg",
  },
]

const researchPrograms = [
  {
    id: 1,
    name: "Alzheimer's Research Initiative",
    organization: "National Genomics Foundation",
    description: "Contributing to research on genetic factors in Alzheimer's disease",
    status: "Participating",
    dataShared: "Anonymized genetic markers related to neurological function",
  },
  {
    id: 2,
    name: "Heart Health Genetic Study",
    organization: "Cardiovascular Research Alliance",
    description: "Investigating genetic factors in heart disease and stroke risk",
    status: "Not Participating",
    dataShared: "None",
  },
  {
    id: 3,
    name: "Pharmacogenomics Database Project",
    organization: "International Drug Response Consortium",
    description: "Building a database of genetic variations affecting drug metabolism",
    status: "Participating",
    dataShared: "Anonymized drug metabolism gene variants",
  },
]

export default function DataSharingPage() {
  const [sharingLink, setSharingLink] = useState("https://geneinsight.example.com/share/abc123xyz789")
  const [linkCopied, setLinkCopied] = useState(false)
  const [sharingSettings, setSharingSettings] = useState({
    allowResearch: true,
    allowAnonymized: true,
    allowRelativeFinder: true,
    allowHealthcareProviders: true,
  })

  const handleCopyLink = () => {
    navigator.clipboard
      .writeText(sharingLink)
      .then(() => {
        setLinkCopied(true)
        setTimeout(() => setLinkCopied(false), 2000)
      })
      .catch((err) => {
        console.error("Failed to copy: ", err)
      })
  }

  const toggleSetting = (setting) => {
    setSharingSettings((prev) => ({
      ...prev,
      [setting]: !prev[setting],
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Sharing Management</h1>
          <p className="text-muted-foreground">Control how your genetic data is shared and accessed</p>
        </div>
      </div>

      <Tabs defaultValue="sharing" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sharing">Sharing Settings</TabsTrigger>
          <TabsTrigger value="access">Access Control</TabsTrigger>
          <TabsTrigger value="research">Research Participation</TabsTrigger>
        </TabsList>

        <TabsContent value="sharing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Sharing Preferences</CardTitle>
              <CardDescription>Control how your genetic information is shared</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Participate in Research</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow your anonymized genetic data to be used for scientific research
                  </p>
                </div>
                <Switch
                  checked={sharingSettings.allowResearch}
                  onCheckedChange={() => toggleSetting("allowResearch")}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Anonymized Data Sharing</Label>
                  <p className="text-sm text-muted-foreground">Share anonymized data with partner institutions</p>
                </div>
                <Switch
                  checked={sharingSettings.allowAnonymized}
                  onCheckedChange={() => toggleSetting("allowAnonymized")}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">DNA Relative Finder</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow your profile to be discoverable by potential genetic relatives
                  </p>
                </div>
                <Switch
                  checked={sharingSettings.allowRelativeFinder}
                  onCheckedChange={() => toggleSetting("allowRelativeFinder")}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Healthcare Provider Access</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow healthcare providers to request access to your genetic data
                  </p>
                </div>
                <Switch
                  checked={sharingSettings.allowHealthcareProviders}
                  onCheckedChange={() => toggleSetting("allowHealthcareProviders")}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Create Sharing Link</CardTitle>
              <CardDescription>Generate a secure link to share your genetic information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sharing-link">Sharing Link</Label>
                  <div className="flex">
                    <Input id="sharing-link" value={sharingLink} readOnly className="rounded-r-none" />
                    <Button onClick={handleCopyLink} variant="secondary" className="rounded-l-none">
                      {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Access Level</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="outline" className="justify-start">
                      <FileText className="mr-2 h-4 w-4" />
                      Full Report
                    </Button>
                    <Button variant="outline" className="justify-start">
                      <Users className="mr-2 h-4 w-4" />
                      Ancestry Only
                    </Button>
                    <Button variant="outline" className="justify-start">
                      <Share2 className="mr-2 h-4 w-4" />
                      Custom...
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expiration">Link Expiration</Label>
                  <select
                    id="expiration"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="7days">7 days</option>
                    <option value="30days">30 days</option>
                    <option value="90days">90 days</option>
                    <option value="never">Never expires</option>
                  </select>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button>Generate New Link</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Shared Access</CardTitle>
                <CardDescription>People and organizations with access to your genetic data</CardDescription>
              </div>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Access Level</TableHead>
                    <TableHead>Date Shared</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sharedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center">
                          <Avatar className="h-8 w-8 mr-2">
                            <AvatarImage src={user.avatar} alt={user.name} />
                            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{user.type}</TableCell>
                      <TableCell>{user.access}</TableCell>
                      <TableCell>{user.date}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invite Someone</CardTitle>
              <CardDescription>
                Share your genetic data with healthcare providers, family members, or researchers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" placeholder="Enter email address" />
                </div>

                <div className="space-y-2">
                  <Label>Access Type</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="outline" className="justify-start">
                      <Users className="mr-2 h-4 w-4" />
                      Family Member
                    </Button>
                    <Button variant="outline" className="justify-start">
                      <Building className="mr-2 h-4 w-4" />
                      Healthcare Provider
                    </Button>
                    <Button variant="outline" className="justify-start">
                      <Share2 className="mr-2 h-4 w-4" />
                      Other
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Access Level</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="outline" className="justify-start">
                      <FileText className="mr-2 h-4 w-4" />
                      Full Access
                    </Button>
                    <Button variant="outline" className="justify-start">
                      <Users className="mr-2 h-4 w-4" />
                      Limited Access
                    </Button>
                    <Button variant="outline" className="justify-start">
                      <Share2 className="mr-2 h-4 w-4" />
                      Custom...
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Personal Message (Optional)</Label>
                  <textarea
                    id="message"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Add a personal message to your invitation"
                  ></textarea>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline">Cancel</Button>
              <Button>
                <Mail className="mr-2 h-4 w-4" />
                Send Invitation
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="research" className="space-y-4">
          <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
            <CardContent className="flex items-start space-x-4 py-4">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-300">Research Participation Notice</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                  Participating in research programs means sharing your anonymized genetic data with research
                  institutions. You can opt out at any time, but data that has already been shared cannot be recalled.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Research Participation</CardTitle>
              <CardDescription>
                Contribute to scientific research by sharing your anonymized genetic data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {researchPrograms.map((program) => (
                <div key={program.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-medium">{program.name}</h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        program.status === "Participating"
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                      }`}
                    >
                      {program.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{program.description}</p>
                  <div className="text-sm mb-4">
                    <span className="font-medium">Organization:</span> {program.organization}
                  </div>
                  <div className="text-sm mb-4">
                    <span className="font-medium">Data Shared:</span> {program.dataShared}
                  </div>
                  <div className="flex justify-end">
                    {program.status === "Participating" ? (
                      <Button variant="outline" size="sm">
                        Opt Out
                      </Button>
                    ) : (
                      <Button size="sm">Participate</Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Research Consent</CardTitle>
              <CardDescription>Manage your consent for research participation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">General Research Consent</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow your anonymized genetic data to be used for general scientific research
                  </p>
                </div>
                <Switch
                  checked={sharingSettings.allowResearch}
                  onCheckedChange={() => toggleSetting("allowResearch")}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Disease-Specific Research</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow your data to be used for research on specific diseases
                  </p>
                </div>
                <Switch checked={true} />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Commercial Research</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow your data to be used for commercial research purposes
                  </p>
                </div>
                <Switch checked={false} />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Contact for Research Studies</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow researchers to contact you about participating in studies
                  </p>
                </div>
                <Switch checked={true} />
              </div>
            </CardContent>
            <CardFooter>
              <Button>Update Consent Preferences</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

