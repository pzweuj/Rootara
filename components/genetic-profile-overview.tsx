"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dna, Globe, Heart, Brain } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { Badge } from "@/components/ui/badge"
import { useReport } from "@/contexts/report-context" 
import { useEffect, useState } from "react" // 添加useState和useEffect
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ExternalLink } from "lucide-react"

const profileData = {
  totalSnps: 0, // 初始化为0，将从API获取
  healthTraits: 127,
  clinvarPathogenic: 20,
  reportId: "RPT_TEMPLATE01", 
}

// 定义单倍群数据接口
interface HaplogroupData {
  y_hap: string
  mt_hap: string
}

export function GeneticProfileOverview() {
  const { currentReportId } = useReport()
  const { t, language } = useLanguage()
  const [ancestryComposition, setAncestryComposition] = useState([
    { region: "East Asian", percentage: 45 },
    { region: "European", percentage: 30 },
    { region: "South Asian", percentage: 15 },
    { region: "African", percentage: 10 },
  ]);
  const [loading, setLoading] = useState(false);
  const [reportInfoLoading, setReportInfoLoading] = useState(false);
  const [haplogroupData, setHaplogroupData] = useState<HaplogroupData | null>(null)
  const [haplogroupLoading, setHaplogroupLoading] = useState(true)
  const [haplogroupError, setHaplogroupError] = useState<string | null>(null)

  profileData.reportId = currentReportId

  // 从API获取报告信息
  useEffect(() => {
    const fetchReportInfo = async () => {
      if (!currentReportId) return;
      
      setReportInfoLoading(true);
      try {
        // 调用我们的Next.js API路由而不是直接调用后端
        const response = await fetch(`/api/report/info`, { 
          method: 'POST', 
          headers: { 
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reportId: currentReportId })
        });
        
        if (!response.ok) {
          throw new Error('获取报告信息失败');
        }
        
        const data = await response.json();
        
        // 如果API返回了错误信息
        if (data.error) {
          throw new Error(data.error);
        }
        
        // 根据API返回格式，totalSnps是数组中的第7个元素（索引为6）
        if (Array.isArray(data) && data.length >= 7) {
          profileData.totalSnps = data[6];
        }
      } catch (error) {
        console.error('获取报告信息错误:', error);
      } finally {
        setReportInfoLoading(false);
      }
    };
    
    fetchReportInfo();
  }, [currentReportId]);

  // 从API获取祖源构成数据
  useEffect(() => {
    const fetchAncestryData = async () => {
      if (!currentReportId) return;
      
      setLoading(true);
      try {
        // 调用我们的Next.js API路由而不是直接调用后端
        const response = await fetch(`/api/ancestry/admixture`, { 
          method: 'POST', 
          headers: { 
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reportId: currentReportId })
        });
        
        if (!response.ok) {
          throw new Error('获取祖源数据失败');
        }
        
        const data = await response.json();
        
        // 如果API返回了错误信息
        if (data.error) {
          throw new Error(data.error);
        }
        
        // 将数据转换为数组格式，按百分比降序排序，并只保留前4个区域
        const sortedData = Object.entries(data)
          .map(([region, percentage]) => ({ region, percentage: Number(percentage) }))
          .sort((a, b) => b.percentage - a.percentage)
          .slice(0, 4);
          
        setAncestryComposition(sortedData);
      } catch (error) {
        console.error('获取祖源数据错误:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAncestryData();
  }, [currentReportId]);

  // 获取单倍群数据
  useEffect(() => {
    const fetchHaplogroupData = async () => {
      if (!currentReportId) {
        console.log("没有可用的报告ID")
        return
      }

      setHaplogroupLoading(true)
      setHaplogroupError(null)

      try {
        // 调用我们的Next.js API路由而不是直接调用后端
        const response = await fetch(`/api/ancestry/haplogroup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reportId: currentReportId }),
        })

        if (!response.ok) {
          throw new Error(`API请求失败: ${response.status}`)
        }

        const data = await response.json()
        
        // 如果API返回了错误信息
        if (data.error) {
          throw new Error(data.error);
        }
        
        setHaplogroupData(data)
      } catch (err) {
        console.error("获取单倍群数据失败:", err)
        setHaplogroupError(err instanceof Error ? err.message : "获取单倍群数据失败")
      } finally {
        setHaplogroupLoading(false)
      }
    }

    fetchHaplogroupData()
  }, [currentReportId])

  // 更新区域名称翻译对象
  const regionTranslations = {
    "zh-CN": {
      "Kushitic": "库希特", 
      "North_Iberian": "北伊比利亚", 
      "East_Iberian": "东伊比利亚", 
      "North_African": "北非", 
      "South_Caucasian": "南高加索", 
      "North_Caucasian": "北高加索", 
      "Paleo_Balkan": "古巴尔干", 
      "Turkic_Altai": "突厥阿尔泰", 
      "Proto_Austronesian": "南太平洋群岛", 
      "Nilotic": "尼罗特", 
      "East_Med": "东地中海", 
      "Omotic": "奥摩地区", 
      "Munda": "蒙达", 
      "North_Amerind": "北美原住民", 
      "Arabic": "阿拉伯", 
      "East_Euro": "东欧", 
      "Central_African": "中非地区", 
      "Andean": "安第斯", 
      "Indo_Chinese": "法属安南", 
      "South_Indian": "南印度", 
      "NE_Asian": "东北亚", 
      "Volgan": "伏尔加", 
      "Mongolian": "蒙古地区", 
      "Siberian": "西伯利亚", 
      "North_Sea_Germanic": "北海日耳曼", 
      "Celtic": "凯尔特", 
      "West_African": "西非地区", 
      "West_Finnic": "西芬兰", 
      "Uralic": "乌拉尔", 
      "Sahelian": "萨赫勒", 
      "NW_Indian": "西北印度", 
      "East_African": "东非地区", 
      "East_Asian": "东亚地区",
      "Amuro_Manchurian": "阿穆尔-满洲", 
      "Scando_Germanic": "斯堪的纳维亚日耳曼", 
      "Iranian": "伊朗", 
      "South_African": "南非", 
      "Amazonian": "亚马逊流域", 
      "Baltic": "波罗的海", 
      "Malay": "马来", 
      "Meso_Amerind": "中美洲原住民", 
      "South_Chinese": "中国华南", 
      "Papuan": "巴布亚", 
      "West_Med": "西地中海", 
      "Pamirian": "帕米尔", 
      "Central_Med": "中地中海", 
      "Tibeto_Burman": "藏缅地区",
      // 保留原有的翻译以防万一
      "European": "欧洲",
      "South_Asian": "南亚",
      "African": "非洲",
    }
  }

  // 修改获取区域名称的函数
  const getRegionName = (region: string) => {
    if (language === "zh-CN" && region in regionTranslations["zh-CN"]) {
      return regionTranslations["zh-CN"][region as keyof typeof regionTranslations["zh-CN"]];
    }
    return region;
  }

  // 单倍群翻译
  const haplogroupTranslations = {
    en: {
      maternalLineage: "Maternal Lineage (mtDNA)",
      paternalLineage: "Paternal Lineage (Y-DNA)",
      loading: "Loading...",
      error: "Failed to load haplogroup data",
    },
    "zh-CN": {
      maternalLineage: "母系遗传 (mtDNA)",
      paternalLineage: "父系遗传 (Y-DNA)",
      loading: "加载中...",
      error: "加载单倍群数据失败",
    },
  }

  const ht = (key: keyof (typeof haplogroupTranslations)[keyof typeof haplogroupTranslations]) => {
    return haplogroupTranslations[language as keyof typeof haplogroupTranslations][key as keyof (typeof haplogroupTranslations)[typeof language]] || key
  }

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-medium flex items-center">
            <Dna className="mr-2 h-5 w-5 text-primary" />
            {language === "en" ? "Genetic Profile Overview" : "基因概况"}
          </CardTitle>
          <Badge variant="outline" className="text-xs font-mono">
            {language === "en" ? "Report ID: " : "报告编号: "}
            {profileData.reportId}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="text-2xl font-semibold mb-4">
              {reportInfoLoading ? (
                <span>{language === "en" ? "Loading..." : "加载中..."}</span>
              ) : (
                <>{profileData.totalSnps.toLocaleString()} {language === "en" ? "Variants Analyzed" : "个位点已分析"}</>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground mb-2">
                  {language === "en" ? "Ancestry Composition" : "祖源构成"}
                </div>
                <div className="space-y-3">
                  {loading ? (
                    <div className="text-sm">{language === "en" ? "Loading..." : "加载中..."}</div>
                  ) : (
                    ancestryComposition.map((ancestry) => (
                      <div key={ancestry.region} className="flex items-center">
                        <span className="text-sm font-medium w-28 mr-24">{getRegionName(ancestry.region)}</span>
                        <div className="flex-1 flex items-center">
                          <div className="w-32 h-3 bg-secondary rounded-full mr-2">
                            <div
                              className="h-3 bg-primary rounded-full"
                              style={{ width: `${ancestry.percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">{ancestry.percentage}%</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                {/* 查看详情按钮 - 移动到祖源构成下方 */}
                <div className="mt-4">
                  <Button variant="outline" size="sm" className="gap-1" asChild>
                    <Link href="/analysis/ancestry">
                      {language === "en" ? "Ancestry Details" : "祖源分析"}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <div className="text-sm text-muted-foreground mb-3 flex justify-between items-center">
              <span>{language === "en" ? "Haplogroups" : "单倍群"}</span>
            </div>
            
            {haplogroupLoading ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-4 border border-blue-200 dark:border-blue-800 flex flex-col items-center justify-center">
                  <p className="text-blue-700 dark:text-blue-300">{ht("loading")}</p>
                </div>
                <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 border border-red-200 dark:border-red-800 flex flex-col items-center justify-center">
                  <p className="text-red-700 dark:text-red-300">{ht("loading")}</p>
                </div>
              </div>
            ) : haplogroupError ? (
              <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 border border-red-200 dark:border-red-800">
                <p className="text-red-700 dark:text-red-300">{ht("error")}: {haplogroupError}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 父系谱系 Y-DNA - 蓝色卡片 */}
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-4 border border-blue-200 dark:border-blue-800 flex flex-col items-center justify-center">
                  <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">{ht("paternalLineage")}</h3>
                  <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{haplogroupData?.y_hap || "未知"}</p>
                </div>

                {/* 母系谱系 mtDNA - 红色卡片 */}
                <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 border border-red-200 dark:border-red-800 flex flex-col items-center justify-center">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">{ht("maternalLineage")}</h3>
                  <p className="text-3xl font-bold text-red-700 dark:text-red-300">{haplogroupData?.mt_hap || "未知"}</p>
                </div>        
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
