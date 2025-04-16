"use client"

import { createContext, useContext, useState, type ReactNode, useEffect } from "react"

type Language = "en" | "zh-CN"

// 定义翻译键的类型
type TranslationKey = keyof typeof translations.en

interface LanguageContextType {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: TranslationKey) => string
}

const translations = {
  en: {
    dashboard: "Dashboard",
    myReports: "My Reports",
    analysisModules: "Analysis Modules",
    tools: "Tools",
    helpCenter: "Help Center",
    allReports: "All Reports",
    uploadNewReport: "Upload New Report",
    ancestryAnalysis: "Ancestry Analysis",
    healthRisks: "Health Risks",
    traitInterpretation: "Trait Interpretation",
    rawData: "Raw Data",
    clinvar: "ClinVar Analysis",
    dataSharingManagement: "Data Sharing Management",
    accountSettings: "Account Settings",
    language: "Language",
    english: "English",
    simplifiedChinese: "中文",
    logOut: "Log Out",
    profile: "Profile",
    dataSharing: "Data Sharing",
    home: "Home",
    geneticDashboard: "My Genetic Dashboard",
    snpsAnalyzed: "SNPs Analyzed",
    ancestryComposition: "Ancestry Composition",
    analysisSummary: "Analysis Summary",
    ancestryRegions: "4 Ancestry Regions",
    healthMarkers: "35 Health Markers",
    traits: "Traits",
    lastUpdated: "Last updated",
    yourDnaIndicates: "Your DNA indicates ancestry from 4 major global regions",
    geneticVariants: "Genetic variants related to health conditions",
    physicalAndBehavioral: "Physical and behavioral genetic traits",
    pathogenicVariants: "Pathogenic Variants",
    exportData: "Export Data",
    totalSnps: "Total SNPs",
    fileFormat: "File Format",
    uploadDate: "Upload Date",
    searchByRsID: "Search by rsID...",
    chromosome: "Chromosome",
    allChromosomes: "All Chromosomes",
    position: "Position",
    genotype: "Genotype",
    actions: "Actions",
    noDataFound: "No matching data found",
    showing: "Showing",
    of: "of",
    previous: "Previous",
    next: "Next",
  },
  "zh-CN": {
    dashboard: "仪表盘",
    myReports: "我的报告",
    analysisModules: "分析模块",
    tools: "工具",
    helpCenter: "帮助中心",
    allReports: "所有报告",
    uploadNewReport: "上传新报告",
    ancestryAnalysis: "祖源分析",
    healthRisks: "健康风险",
    traitInterpretation: "特征解读",
    rawData: "报告原始数据",
    clinvar: "ClinVar 分析",
    dataSharingManagement: "数据共享管理",
    accountSettings: "账户设置",
    language: "语言",
    english: "English",
    simplifiedChinese: "中文",
    logOut: "退出登录",
    profile: "个人资料",
    dataSharing: "数据共享",
    home: "首页",
    geneticDashboard: "我的基因",
    snpsAnalyzed: "个SNP已分析",
    ancestryComposition: "祖源构成",
    analysisSummary: "分析摘要",
    ancestryRegions: "4个祖源区域",
    healthMarkers: "35个健康标记",
    traits: "个特征",
    lastUpdated: "最近更新",
    yourDnaIndicates: "您的DNA显示来自4个主要全球区域的祖源",
    geneticVariants: "与健康状况相关的基因变异",
    physicalAndBehavioral: "身体和行为的基因特征",
    pathogenicVariants: "致病变异",
    exportData: "导出数据",
    totalSnps: "SNP总数",
    fileFormat: "文件格式",
    uploadDate: "上传日期",
    searchByRsID: "按rsID搜索...",
    chromosome: "染色体",
    allChromosomes: "所有染色体",
    position: "位置",
    genotype: "基因型",
    actions: "操作",
    noDataFound: "未找到匹配的数据",
    showing: "显示",
    of: "/",
    previous: "上一页",
    next: "下一页",
  },
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en")

  // Load language preference from localStorage on initial render
  useEffect(() => {
    const savedLanguage = localStorage.getItem("language") as Language
    if (savedLanguage && (savedLanguage === "en" || savedLanguage === "zh-CN")) {
      setLanguageState(savedLanguage)
    }
  }, [])

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage)
    localStorage.setItem("language", newLanguage)
  }

  const t = (key: TranslationKey): string => {
    return translations[language][key] || key
  }

  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>
}
