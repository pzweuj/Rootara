"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Info } from "lucide-react"
import { HaplogroupDistribution } from "@/components/haplogroup-distribution"
import { useLanguage } from "@/contexts/language-context"
import { useReport } from "@/contexts/report-context"
import { useEffect, useRef, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'

// 定义祖源数据类型接口
interface AncestryData {
  [key: string]: number;
}

// 默认的空祖源数据
const emptyAncestryData: AncestryData = {};

// 动态导入Leaflet (客户端渲染)
const LeafletMap = dynamic(() => import('./map-component'), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] w-full flex items-center justify-center bg-gray-100 rounded-lg">
      <p className="text-muted-foreground">{useLanguage().t("loadingMap")}</p>
    </div>
  )
})

export default function AncestryAnalysisPage() {
  const { language, t } = useLanguage()
  // 获取当前报告ID
  const { currentReportId } = useReport()
  const [ancestryData, setAncestryData] = useState<AncestryData>(emptyAncestryData)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  // 添加一个key状态，用于控制地图组件是否重新渲染
  const mapInstanceKey = useRef('map-instance-1').current

  // 区域名称翻译对象
  const regionNames = {
    en: {
      "Kushitic": "Kushitic",
      "North Iberian": "North Iberian",
      "East Iberian": "East Iberian",
      "North African": "North African",
      "South Caucasian": "South Caucasian",
      "North Caucasian": "North Caucasian",
      "Paleo Balkan": "Paleo Balkan",
      "Turkic Altai": "Turkic Altai",
      "Proto Austronesian": "Proto Austronesian",
      "Nilotic": "Nilotic",
      "East Med": "East Mediterranean",
      "Omotic": "Omotic",
      "Munda": "Munda",
      "North Amerind": "North Amerind",
      "Arabic": "Arabic",
      "East Euro": "East European",
      "Central African": "Central African",
      "Andean": "Andean",
      "Indo Chinese": "Indo-Chinese",
      "South Indian": "South Indian",
      "NE Asian": "Northeast Asian",
      "Volgan": "Volgan",
      "Mongolian": "Mongolian",
      "Siberian": "Siberian",
      "North Sea Germanic": "North Sea Germanic",
      "Celtic": "Celtic",
      "West African": "West African",
      "West Finnic": "West Finnic",
      "Uralic": "Uralic",
      "Sahelian": "Sahelian",
      "NW Indian": "Northwest Indian",
      "East African": "East African",
      "East Asian": "East Asian",
      "Amuro Manchurian": "Amuro-Manchurian",
      "Scando Germanic": "Scando-Germanic",
      "Iranian": "Iranian",
      "South African": "South African",
      "Amazonian": "Amazonian",
      "Baltic": "Baltic",
      "Malay": "Malay",
      "Meso Amerind": "Mesoamerind",
      "South Chinese": "South Chinese",
      "Papuan": "Papuan",
      "West Med": "West Mediterranean",
      "Pamirian": "Pamirian",
      "Central Med": "Central Mediterranean",
      "Tibeto Burman": "Tibeto Burman"
    },
    "zh-CN": {
      "Kushitic": "库希特",
      "North Iberian": "北伊比利亚",
      "East Iberian": "东伊比利亚",
      "North African": "北非",
      "South Caucasian": "南高加索",
      "North Caucasian": "北高加索",
      "Paleo Balkan": "古巴尔干",
      "Turkic Altai": "突厥阿尔泰",
      "Proto Austronesian": "南太平洋群岛",
      "Nilotic": "尼罗特",
      "East Med": "东地中海",
      "Omotic": "奥摩地区",
      "Munda": "蒙达",
      "North Amerind": "北美原住民",
      "Arabic": "阿拉伯",
      "East Euro": "东欧",
      "Central African": "中非地区",
      "Andean": "安第斯",
      "Indo Chinese": "法属安南",
      "South Indian": "南印度",
      "NE Asian": "东北亚",
      "Volgan": "伏尔加",
      "Mongolian": "蒙古地区",
      "Siberian": "西伯利亚",
      "North Sea Germanic": "北海日耳曼",
      "Celtic": "凯尔特",
      "West African": "西非地区",
      "West Finnic": "西芬兰",
      "Uralic": "乌拉尔",
      "Sahelian": "萨赫勒",
      "NW Indian": "西北印度",
      "East African": "东非地区",
      "East Asian": "东亚地区",
      "Amuro Manchurian": "阿穆尔-满洲",
      "Scando Germanic": "斯堪的纳维亚日耳曼",
      "Iranian": "伊朗",
      "South African": "南非",
      "Amazonian": "亚马逊流域",
      "Baltic": "波罗的海",
      "Malay": "马来",
      "Meso Amerind": "中美洲原住民",
      "South Chinese": "中国华南",
      "Papuan": "巴布亚",
      "West Med": "西地中海",
      "Pamirian": "帕米尔",
      "Central Med": "中地中海",
      "Tibeto Burman": "藏缅地区",
    },
  }

  // 从API获取祖源数据
  // 修改fetchAncestryData函数
  const fetchAncestryData = async (reportId: string) => {
    if (!reportId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // 调用我们的Next.js API路由而不是直接调用后端
      const response = await fetch(`/api/ancestry/admixture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reportId })
      });
      
      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // 如果API返回了错误信息
      if (data.error) {
        throw new Error(data.error);
      }
      
      // 处理API返回的数据，将下划线替换为连字符以匹配UI显示格式
      const formattedData: AncestryData = {};
      Object.entries(data).forEach(([key, value]) => {
        // 只保留有值的数据项
        if (value && (value as number) > 0) {
          // 将下划线替换为连字符
          const formattedKey = key.replace(/_/g, '-');
          formattedData[formattedKey] = value as number;
        }
      });
      
      setAncestryData(formattedData);
    } catch (err) {
      console.error('获取祖源数据失败:', err);
      setError(err instanceof Error ? err.message : '未知错误');
      
      // 在开发环境中使用模拟数据
      if (process.env.NODE_ENV === 'development') {
        const mockData: AncestryData = {
          "Kushitic": 5.2,
          "North-Iberian": 12.8,
          "East-Iberian": 3.5,
          "North-African": 2.1,
          "South-Caucasian": 4.7,
          "North-Caucasian": 1.9,
          "Paleo-Balkan": 3.2,
          "Turkic-Altai": 8.5,
          "East-Asian": 25.3,
          "Celtic": 7.8,
          "West-African": 4.2,
          "NW-Indian": 6.9,
          "Iranian": 5.4,
          "Baltic": 3.7,
          "West-Med": 4.8
        };
        setAncestryData(mockData);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 当报告ID变化时获取数据
  useEffect(() => {
    fetchAncestryData(currentReportId);
  }, [currentReportId]);

  // 根据比例返回不同深度的颜色
  const getColor = (percentage: number): string => {
    return percentage > 80 ? '#034E7B' :   // 最深蓝色
           percentage > 60 ? '#0868A6' :   // 深蓝色
           percentage > 40 ? '#2E88C5' :   // 中深蓝色
           percentage > 20 ? '#4AA6DB' :   // 中蓝色
           percentage > 10 ? '#72B9E3' :   // 中浅蓝色
           percentage > 5  ? '#93C8E7' :   // 浅蓝色
           percentage > 0  ? '#7EBCE4' :   // 调整后的最低比例颜色
                            '#F5F5F5';     // 无数据区域颜色
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{String(t("ancestryAnalysis"))}</h1>
          <p className="text-muted-foreground">{String(t("exploreGenetic"))}</p>
        </div>
        <Badge variant="outline" className="text-xs font-mono"> 
          {t("reportId")} 
          {currentReportId} 
        </Badge>
      </div>

      {/* 祖源构成部分 */}
      <div>
        {/* <h2 className="text-2xl font-bold mb-4">{t("ancestryComposition")}</h2> */}
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-semibold">{t("ancestryMap")}</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="h-[400px] w-full flex items-center justify-center bg-gray-100 rounded-lg">
                    <p className="text-muted-foreground">{t("loadingAncestryData")}</p>
                  </div>
                ) : error ? (
                  <div className="h-[400px] w-full flex items-center justify-center bg-gray-100 rounded-lg">
                    <div className="text-center">
                      <p className="text-red-500 mb-2">{t("errorLoadingData")}</p>
                      <p className="text-sm text-muted-foreground">{error}</p>
                      <button 
                        onClick={() => fetchAncestryData(currentReportId)}
                        className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
                      >
                        {t("retry")}
                      </button>
                    </div>
                  </div>
                ) : Object.keys(ancestryData).length === 0 ? (
                  <div className="h-[400px] w-full flex items-center justify-center bg-gray-100 rounded-lg">
                    <p className="text-muted-foreground">{t("noAncestryData")}</p>
                  </div>
                ) : (
                  <LeafletMap key={mapInstanceKey} data={ancestryData} />
                )}
                
                <div className="mt-6 relative">
                  <h4 className="text-lg font-medium mb-3">{String(t("ancestryProportion"))}</h4>
                  {isLoading ? (
                    <div className="py-8 flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : error && Object.keys(ancestryData).length === 0 ? (
                    <div className="py-8 text-center text-red-500">
                      {t("failedToLoadAncestryData")}
                    </div>
                  ) : Object.keys(ancestryData).length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      {t("noAncestryData")}
                    </div>
                  ) : (
                    <div className="space-y-2 relative">
                      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none transition-opacity duration-300"
                           style={{ opacity: isExpanded ? 0 : 1 }} />
                      
                      <div className="max-h-[200px] overflow-y-auto transition-all duration-300"
                           style={{ maxHeight: isExpanded ? '500px' : '200px' }}>
                        {Object.entries(ancestryData)
                          .map(([region, value]) => ({
                            region: region.replace(/-/g, ' '),
                            percentage: value.toFixed(2),
                            value
                          }))
                          .sort((a, b) => b.value - a.value)
                          .map((item, index) => (
                            <div 
                              key={index} 
                              className="flex items-center justify-between py-1.5 relative"
                            >
                              <div className="absolute left-0 top-0 bottom-0"
                                   style={{
                                     backgroundColor: getColor(item.value),
                                     width: `${item.value}%`,
                                     maxWidth: '100%',
                                     opacity: 0.7
                                   }} />
                              <span className="relative z-10 text-gray-600">
                                {regionNames[language][item.region as keyof typeof regionNames['en']] || item.region}
                              </span>
                              <span className="font-medium relative z-10 text-gray-600">
                                {item.percentage}%
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                  
                  {Object.keys(ancestryData).length > 0 && (
                    <button 
                      className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-4 text-sm text-gray-600 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 rounded-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-200"
                      onClick={() => setIsExpanded(!isExpanded)}
                    >
                      <span className="font-medium">
                        {isExpanded ? String(t("showLess")) : String(t("showMore"))}
                      </span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 transition-transform duration-300 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* 右侧卡片部分 */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{String(t("understandingResults"))}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{String(t("compositionDescription"))}</p>
                <div className="flex items-start space-x-2">
                  <Info className="h-5 w-5 text-primary mt-0.5" />
                  <p className="text-sm">{String(t("analysisDescription"))}</p>
                </div>

                {/* 添加 Admixture 技术介绍 */}
                <div className="pt-2">
                  <h3 className="text-sm font-medium mb-1">{String(t("admixtureTechnology"))}</h3>
                  <p className="text-sm text-muted-foreground">{String(t("admixtureTechDescription"))}</p>
                </div>

                {/* 添加单倍群介绍 */}
                <div className="pt-2">
                  <h3 className="text-sm font-medium mb-1">{String(t("haplogroupsExplained"))}</h3>
                  <p className="text-sm text-muted-foreground">{String(t("haplogroupsExplainedDescription"))}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* 单倍群部分 */}
      <div>
        <h2 className="text-2xl font-bold mb-4">{String(t("haplogroups"))}</h2>
        <HaplogroupDistribution />
      </div>
    </div>
  )
}
