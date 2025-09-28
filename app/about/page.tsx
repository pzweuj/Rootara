"use client"

import { useLanguage } from "@/contexts/language-context"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink, Github, Star } from "lucide-react"
import Link from "next/link"

interface LicenseInfo {
  name: string
  version: string
  license: string
  description: {
    en: string
    "zh-CN": string
  }
  url?: string
  repository?: string
  licenseUrl?: string
}

const openSourceLibraries: LicenseInfo[] = [
  {
    name: "Next.js",
    version: "15.2.4",
    license: "MIT",
    description: {
      en: "React framework for production-grade applications",
      "zh-CN": "用于生产级应用的 React 框架",
    },
    url: "https://nextjs.org/",
    repository: "https://github.com/vercel/next.js",
  },
  {
    name: "React",
    version: "19.x",
    license: "MIT",
    description: {
      en: "JavaScript library for building user interfaces",
      "zh-CN": "用于构建用户界面的 JavaScript 库",
    },
    url: "https://reactjs.org/",
    repository: "https://github.com/facebook/react",
  },
  {
    name: "TypeScript",
    version: "5.x",
    license: "Apache-2.0",
    description: {
      en: "Typed superset of JavaScript that compiles to plain JavaScript",
      "zh-CN": "编译为纯 JavaScript 的 JavaScript 类型化超集",
    },
    url: "https://www.typescriptlang.org/",
    repository: "https://github.com/microsoft/TypeScript",
  },
  {
    name: "Tailwind CSS",
    version: "3.4.17",
    license: "MIT",
    description: {
      en: "Utility-first CSS framework for rapid UI development",
      "zh-CN": "用于快速 UI 开发的实用优先 CSS 框架",
    },
    url: "https://tailwindcss.com/",
    repository: "https://github.com/tailwindlabs/tailwindcss",
  },
  {
    name: "Radix UI",
    version: "1.x",
    license: "MIT",
    description: {
      en: "Low-level UI primitives with accessibility and customization in mind",
      "zh-CN": "考虑可访问性和自定义的低级 UI 原语",
    },
    url: "https://www.radix-ui.com/",
    repository: "https://github.com/radix-ui/primitives",
  },
  {
    name: "Lucide React",
    version: "0.454.0",
    license: "ISC",
    description: {
      en: "Beautiful & consistent icon toolkit made by the community",
      "zh-CN": "由社区制作的美观且一致的图标工具包",
    },
    url: "https://lucide.dev/",
    repository: "https://github.com/lucide-icons/lucide",
  },
  {
    name: "class-variance-authority",
    version: "0.7.1",
    license: "Apache-2.0",
    description: {
      en: "CSS-in-TS variants API that focuses on developer experience",
      "zh-CN": "专注于开发者体验的 CSS-in-TS 变体 API",
    },
    repository: "https://github.com/joe-bell/cva",
  },
  {
    name: "clsx",
    version: "2.1.1",
    license: "MIT",
    description: {
      en: "Tiny utility for constructing className strings conditionally",
      "zh-CN": "用于有条件地构造 className 字符串的小工具",
    },
    repository: "https://github.com/lukeed/clsx",
  },
  {
    name: "admix",
    version: "1fd5181",
    license: "GPL-3.0",
    description: {
      en: "An admixture analysis tool for Python that supports raw data from 23andme, AncestryDNA, etc.",
      "zh-CN":
        "一个用于 Python 的 admixture 分析工具，支持 23andme、AncestryDNA 等原始数据。",
    },
    repository: "https://github.com/stevenliuyi/admix",
  },
  {
    name: "haploGrouper",
    version: "1.1",
    license: "Apache-2.0",
    description: {
      en: "A software to classify haplotypes into haplogroups on the basis of a known phylogenetic tree.",
      "zh-CN": "一个基于已知的系统发育树，将等位基因进行单倍群分组的软件。",
    },
    url: "https://gitlab.com/bio_anth_decode/haploGrouper",
  },
  {
    name: "pandas",
    version: "2.3.0",
    license: "BSD-3",
    description: {
      en: "Flexible and powerful data analysis / manipulation library for Python, providing labeled data structures similar to R data.frame objects, statistical functions, and much more.",
      "zh-CN":
        "一个用于 Python 的数据分析和操作库，提供类似于 R 中 data.frame 对象的带标签数据结构、统计函数等。",
    },
    url: "https://pandas.pydata.org",
    repository: "https://github.com/pandas-dev/pandas",
  },
  {
    name: "pysam",
    version: "0.23.3",
    license: "MIT",
    description: {
      en: "Pysam is a Python package for reading, manipulating, and writing genomics data such as SAM/BAM/CRAM and VCF/BCF files. It's a lightweight wrapper of the HTSlib API, the same one that powers samtools, bcftools, and tabix.",
      "zh-CN":
        "一个用于 Python 的生物学数据处理库，提供对 SAM/BAM/CRAM 和 VCF/BCF 文件的读取、操作和写入功能。",
    },
    repository: "https://github.com/pysam-developers/pysam",
  },
  {
    name: "sqlite3",
    version: "3.50.1",
    license: "Custom",
    licenseUrl: "https://github.com/sqlite/sqlite?tab=License-1-ov-file",
    description: {
      en: "SQLite is a C-language library that implements a small, fast, self-contained, high-reliability, full-featured, SQL database engine.",
      "zh-CN":
        "SQLite 是一个 C 语言库，它实现了一个小型、快速、自包含、高可靠性、功能齐全的 SQL 数据库引擎。",
    },
    url: "https://www.sqlite.org",
    repository: "https://github.com/sqlite/sqlite",
  },
  {
    name: "FastAPI",
    version: "0.115.12",
    license: "MIT",
    description: {
      en: "FastAPI framework, high performance, easy to learn, fast to code, ready for production.",
      "zh-CN":
        "一个用于 Python 的高性能 Web 框架，易于学习，快速开发，适用于生产环境。",
    },
    url: "https://fastapi.tiangolo.com",
    repository: "https://github.com/fastapi/fastapi",
  },
]

export default function AboutPage() {
  const { t, language } = useLanguage()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">{t("about")}</h1>
        <p className="text-muted-foreground">{t("licenseInformation")}</p>
      </div>

      {/* Project Description Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            {t("projectDescription")}
          </CardTitle>
          <CardDescription>{t("geneticAnalysis")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm leading-relaxed">{t("rootaraDescription")}</p>
            <div className="flex items-center gap-4">
              {/* <Badge variant="secondary" className="flex items-center gap-1">
                <Github className="h-3 w-3" />
                {t("openSource")}
              </Badge> */}
              <Button asChild variant="outline" size="sm">
                <Link
                  href="https://github.com/pzweuj/Rootara"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <Github className="h-4 w-4" />
                  {t("viewOnGithub")}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            {t("openSourceLicenses")}
          </CardTitle>
          <CardDescription>{t("thisProjectUses")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">
                    {t("softwareName")}
                  </th>
                  <th className="text-left py-3 px-4 font-medium">
                    {t("version")}
                  </th>
                  <th className="text-left py-3 px-4 font-medium">
                    {t("license")}
                  </th>
                  <th className="text-left py-3 px-4 font-medium">
                    {t("description")}
                  </th>
                  <th className="text-left py-3 px-4 font-medium">Links</th>
                </tr>
              </thead>
              <tbody>
                {openSourceLibraries.map((lib, index) => (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4 font-medium">{lib.name}</td>
                    <td className="py-3 px-4">
                      <Badge variant="secondary">{lib.version}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">
                        {lib.licenseUrl ? (
                          <Link
                            href={lib.licenseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {lib.license}
                          </Link>
                        ) : (
                          lib.license
                        )}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {
                        lib.description[
                          language as keyof typeof lib.description
                        ]
                      }
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        {lib.url && (
                          <Link
                            href={lib.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        )}
                        {lib.repository && (
                          <Link
                            href={lib.repository}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                          >
                            <Github className="h-4 w-4" />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="text-center text-sm text-muted-foreground">
        <p>
          {language === "zh-CN"
            ? "感谢所有开源软件的贡献者们！"
            : "Thanks to all the contributors of these open source projects!"}
        </p>
      </div>
    </div>
  )
}
