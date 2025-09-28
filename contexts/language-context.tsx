"use client"

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  useEffect,
} from "react"

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
    myReports: "Reports",
    analysisModules: "Analysis Modules",
    tools: "Tools",
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
    geneticDashboard: "Genetic Dashboard",
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
    other_link: "Links",
    noDataFound: "No matching data found",
    showing: "Showing",
    of: "of",
    previous: "Previous",
    next: "Next",
    loading: "Loading...",
    about: "About",
    openSourceLicenses: "Open Source Licenses",
    licenseInformation: "License Information",
    thisProjectUses: "This project uses the following open source software:",
    softwareName: "Software Name",
    version: "Version",
    license: "License",
    description: "Description",
    projectDescription: "Project Description",
    rootaraDescription:
      "Rootara is an open-source genetic analysis platform that provides comprehensive genomic data interpretation, including ancestry analysis, trait interpretation, and health risk assessment.",
    viewOnGithub: "View on GitHub",
    openSource: "Open Source",
    geneticAnalysis: "Genetic Analysis Platform",
    // Report Switcher
    deleteFailed: "Delete Failed",
    error: "Error",
    invalidReportId: "Invalid report ID",
    operationDenied: "Operation Denied",
    cannotDeleteTemplate: "Cannot delete template report",
    debugInfo: "Debug Info",
    renameSuccessful: "Rename Successful",
    reportNameUpdated: "The report name has been updated",
    renameFailed: "Rename Failed",
    reportSwitched: "Report Switched",
    nowViewing: "Now viewing",
    enterNewReportName: "Enter a new name for the report",
    currentlyViewing: "Now viewing: ",
    unknownError: "Unknown error",
    exportError: "Export ERROR",
    unknownErrorChinese: "未知错误",
    setDefaultSuccess: "Set Default Success",
    reportSetAsDefault: "Report set as default",
    setDefaultFailed: "Set Default Failed",
    uploadNewReport: "Upload New Report",
    searchReports: "Search reports...",
    allReports: "All Reports",
    sort: "Sort",
    sortBy: "Sort by",
    name: "Name",
    source: "Source",
    ascending: "Ascending",
    descending: "Descending",
    default: "Default",
    viewReport: "View Report",
    setAsDefault: "Set as Default",
    download: "Export",
    delete: "Delete",
    noReportsFound: "No reports found matching your criteria",
    snpCount: "Variants Count:",
    rename: "Rename",
    renameReport: "Rename Report",
    reportName: "Report Name",
    reportNameZh: "Report Name (Chinese)",
    cancel: "Cancel",
    save: "Save",
    deleteConfirmTitle: "Delete Report",
    deleteConfirmMessage:
      "Are you sure you want to delete this report? This action cannot be undone.",
    // Raw Genetic Data
    mitochondria: "Mitochondria",
    rawData: "Raw Data",
    searchByRsID: "Search by rsID...",
    allChromosomes: "All Chromosomes",
    // Health Risk Summary
    healthRiskSummary: "Health Risk Summary",
    viewDetailedHealthReport: "View Detailed Health Report",
    geneticVariantsAnalyzed: "genetic variants analyzed",
    // Genetic Profile Overview
    geneticProfileOverview: "Genetic Profile Overview",
    reportId: "Report ID: ",
    variantsAnalyzed: "Variants Analyzed",
    loadingMap: "Loading map...",
    ancestryDetails: "Ancestry Details",
    haplogroups: "Haplogroups",
    // Login
    enterEmailPassword: "Please enter both email and password",
    invalidCredentials: "Invalid email or password",
    switchToChinese: "Switch to Chinese",
    welcomeBack: "Welcome to Rootara",
    enterCredentials: "Enter your credentials to access your genetic data",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    signingIn: "Signing in...",
    emailPlaceholder: "name@example.com",
    discoverGenetic:
      "Discover your genetic heritage and unlock insights about your health and traits.",
    lightMode: "Light mode",
    darkMode: "Dark mode",
    // Traits
    traitDeletedSuccessfully: "Trait deleted successfully",
    // ClinVar
    clinvarAnalysis: "ClinVar Analysis",
    clinvarNoticeTitle: "Important Notice",
    clinvarNoticeContent:
      "Genetic testing is not a diagnostic tool. Always consult with a healthcare professional before making any medical decisions based on these results.",
    pathogenicVariants: "Pathogenic Variants",
    likelyPathogenic: "Likely Pathogenic",
    uncertainSignificance: "Uncertain Significance",
    likelyBenign: "Likely Benign",
    benign: "Benign",
    recentFindings: "Findings",
    viewDetails: "View Variants",
    totalVariants: "Total Variants Analyzed",
    gene: "Gene",
    condition: "Condition",
    classification: "Classification",
    noVariantsFound: "No variants found",
    searchVariants: "Search variants...",
    allClassifications: "All Classifications",
    variantId: "Variant ID",
    chromosome: "Chromosome",
    position: "Position",
    genotype: "Genotype",
    page: "Page",
    of: "of",
    itemsPerPage: "Items per page",
    prev: "Previous",
    next: "Next",
    clinvarDescription:
      "ClinVar is a public database of reports of the relationships among human variations and phenotypes, with supporting evidence. Rootara filtered out insertions and deletions because gene chips may not accurately detect these types.",
    // Ancestry
    ancestryMap: "Ancestry Map",
    interactiveAncestryMap:
      "Interactive ancestry map visualization would appear here",
    loadingAncestryData: "Loading ancestry data...",
    errorLoadingData: "Error loading data",
    retry: "Retry",
    noAncestryData: "No ancestry data available",
    failedToLoadAncestryData: "Failed to load ancestry data",
    view: "View",
    global: "Global",
    european: "European",
    asian: "Asian",
    african: "African",
    subregions: "Subregions",
    ancestryAnalysis: "Ancestry Analysis",
    exploreGenetic: "Explore your genetic ancestry and find DNA relatives",
    understandingResults: "Understanding Your Results",
    compositionDescription:
      "Your ancestry composition estimates the proportion of your DNA that comes from each of 47 populations worldwide.",
    analysisDescription:
      "The analysis is based on comparing your genome to reference populations from around the world.",
    admixtureTechnology: "Admixture",
    admixtureTechDescription:
      "Admixture analysis uses statistical methods to estimate the proportion of your genome derived from different ancestral populations. This technique compares segments of your DNA to reference panels from diverse global populations.",
    haplogroupsExplained: "Haplogroups",
    haplogroupsExplainedDescription:
      "Haplogroups are genetic population groups that share a common ancestor. Y-DNA haplogroups trace paternal lineage (Chrom Y), while mtDNA haplogroups trace maternal lineage (Mitochondria). These markers remain relatively unchanged over generations, providing insights into ancient migration patterns.",
    ancestryProportion: "Ancestry Proportion",
    showMore: "Show More",
    showLess: "Show Less",
    // Traits
    notice:
      "Note: These trait analyses are based on literature and user-contributed data, not clinical-grade interpretation. Results are for informational purposes only and should not be used as medical advice.",
  },
  "zh-CN": {
    dashboard: "仪表盘",
    myReports: "报告",
    analysisModules: "分析模块",
    tools: "工具",
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
    geneticDashboard: "结果总览",
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
    other_link: "链接",
    noDataFound: "未找到匹配的数据",
    showing: "显示",
    of: "/",
    previous: "上一页",
    next: "下一页",
    loading: "加载中...",
    about: "关于",
    openSourceLicenses: "开源软件许可",
    licenseInformation: "许可信息",
    thisProjectUses: "本项目使用了以下开源软件：",
    softwareName: "软件名称",
    version: "版本",
    license: "许可证",
    description: "描述",
    projectDescription: "项目描述",
    rootaraDescription:
      "Rootara 是一个开源的基因分析平台，提供全面的基因组数据解读，包括祖源分析、特征解读和健康风险评估。",
    viewOnGithub: "在 GitHub 上查看",
    openSource: "开源项目",
    geneticAnalysis: "基因分析平台",
    // Report Switcher
    deleteFailed: "删除失败",
    error: "错误",
    invalidReportId: "无效的报告ID",
    operationDenied: "操作被拒绝",
    cannotDeleteTemplate: "不能删除模板报告",
    debugInfo: "调试信息",
    renameSuccessful: "重命名成功",
    reportNameUpdated: "报告名称已更新",
    renameFailed: "重命名失败",
    reportSwitched: "报告已切换",
    nowViewing: "当前查看",
    enterNewReportName: "请输入新的报告名称",
    currentlyViewing: "当前查看: ",
    unknownError: "未知错误",
    exportError: "导出错误",
    unknownErrorChinese: "未知错误",
    setDefaultSuccess: "设置成功",
    reportSetAsDefault: "报告已设为默认",
    setDefaultFailed: "设置失败",
    uploadNewReport: "上传新报告",
    searchReports: "搜索报告...",
    allReports: "所有报告",
    sort: "排序",
    sortBy: "排序方式",
    name: "名称",
    source: "来源",
    ascending: "升序",
    descending: "降序",
    default: "默认",
    viewReport: "查看报告",
    setAsDefault: "设为默认",
    download: "导出",
    delete: "删除",
    noReportsFound: "未找到符合条件的报告",
    snpCount: "位点数量：",
    rename: "重命名",
    renameReport: "重命名报告",
    reportName: "报告名称",
    reportNameZh: "报告名称（中文）",
    cancel: "取消",
    save: "保存",
    deleteConfirmTitle: "删除报告",
    deleteConfirmMessage: "确定要删除此报告吗？此操作无法撤销。",
    // Raw Genetic Data
    mitochondria: "线粒体",
    rawData: "原始基因数据",
    searchByRsID: "按rsID搜索...",
    allChromosomes: "所有染色体",
    // Health Risk Summary
    healthRiskSummary: "健康风险摘要",
    viewDetailedHealthReport: "查看详细健康报告",
    geneticVariantsAnalyzed: "个基因变异已分析",
    // Genetic Profile Overview
    geneticProfileOverview: "基因概况",
    reportId: "报告编号: ",
    variantsAnalyzed: "个位点已分析",
    loadingMap: "地图加载中...",
    ancestryDetails: "祖源分析",
    haplogroups: "单倍群",
    // Login
    enterEmailPassword: "请输入邮箱和密码",
    invalidCredentials: "邮箱或密码错误",
    switchToChinese: "切换为英文",
    welcomeBack: "欢迎使用 Rootara",
    enterCredentials: "请输入您的凭据以访问您的基因数据",
    email: "邮箱",
    password: "密码",
    signIn: "登录",
    signingIn: "登录中...",
    emailPlaceholder: "name@example.com",
    discoverGenetic: "探索您的基因，解锁您的遗传健康和个人特征。",
    lightMode: "亮色模式",
    darkMode: "暗色模式",
    // Traits
    traitDeletedSuccessfully: "特征删除成功",
    // ClinVar
    clinvarAnalysis: "ClinVar 分析",
    clinvarNoticeTitle: "重要提示",
    clinvarNoticeContent:
      "基因检测不是诊断工具。在基于这些结果做出任何医疗决定之前，请务必咨询医疗专业人士。",
    pathogenicVariants: "致病变异",
    likelyPathogenic: "可能致病",
    uncertainSignificance: "意义不明确",
    likelyBenign: "可能良性",
    benign: "良性",
    recentFindings: "发现",
    viewDetails: "查看位点",
    totalVariants: "分析的总变异数",
    gene: "基因",
    condition: "疾病",
    classification: "分类",
    noVariantsFound: "没有找到变异",
    searchVariants: "搜索变异...",
    allClassifications: "所有分类",
    variantId: "变异ID",
    chromosome: "染色体",
    position: "位置",
    genotype: "基因型",
    page: "页",
    of: "共",
    itemsPerPage: "每页显示",
    prev: "上一页",
    next: "下一页",
    clinvarDescription:
      "ClinVar是一个公共数据库，报告人类变异与表型之间的关系，并提供支持证据。Rootara过滤了插入和缺失位点，因为基因芯片对该类型可能无法准确检测。",
    // Ancestry
    ancestryMap: "祖源地图",
    interactiveAncestryMap: "交互式祖源地图可视化将在此处显示",
    loadingAncestryData: "正在加载祖源数据...",
    errorLoadingData: "数据加载失败",
    retry: "重试",
    noAncestryData: "暂无祖源数据",
    failedToLoadAncestryData: "加载祖源数据失败",
    view: "视图",
    global: "全球",
    european: "欧洲",
    asian: "亚洲",
    african: "非洲",
    subregions: "子区域",
    ancestryAnalysis: "祖源分析",
    exploreGenetic: "探索您的遗传祖源并寻找DNA亲缘关系",
    understandingResults: "了解您的结果",
    compositionDescription:
      "您的祖源构成估计了您的DNA中来自全球47个人群的比例。",
    analysisDescription: "该分析基于将您的基因组与世界各地的参考人群进行比较。",
    admixtureTechnology: "Admixture算法",
    admixtureTechDescription:
      "Admixture算法使用统计方法来估计您的基因组中源自不同祖先人群的比例。这种技术将您DNA的片段与来自全球不同人群的参考数据集进行比较。",
    haplogroupsExplained: "单倍群解析",
    haplogroupsExplainedDescription:
      "单倍群是共享共同祖先的遗传人群。Y-DNA单倍群追踪父系血统（Y染色体），而mtDNA单倍群追踪母系血统（线粒体）。这些标记在几代人中保持相对不变，提供了对古代迁徙模式的见解。",
    ancestryProportion: "祖源比例",
    showMore: "显示更多内容",
    showLess: "收起内容",
    // Traits
    notice:
      "注意：这些特征分析基于文献和用户贡献的数据，不是临床级别的解读。结果仅供参考，不应用作医疗建议。",
  },
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
)

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
    if (
      savedLanguage &&
      (savedLanguage === "en" || savedLanguage === "zh-CN")
    ) {
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

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}
