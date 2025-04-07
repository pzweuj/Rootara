"use client"

import { useSettings } from "@/contexts/settings-context"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Shield, Bell, Eye, Lock, Download, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { useLanguage } from "@/contexts/language-context"

const defaultAvatars = [
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/9439775.jpg-4JVJWOjPksd3DtnBYJXoWHA5lc1DU9.jpeg",
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/375238645_11475210.jpg-lU8bOe6TLt5Rv51hgjg8NT8PsDBmvN.jpeg",
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/375238208_11475222.jpg-poEIzVHAGiIfMFQ7EiF8PUG1u0Zkzz.jpeg",
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/dd.jpg-4MCwPC2Bec6Ume26Yo1kao3CnONxDg.jpeg",
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/9334178.jpg-Y74tW6XFO68g7N36SE5MSNDNVKLQ08.jpeg",
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/5295.jpg-fLw0wGGZp8wuTzU5dnyfjZDwAHN98a.jpeg",
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/9720029.jpg-Yf9h2a3kT7rYyCb648iLIeHThq5wEy.jpeg",
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/27470341_7294795.jpg-XE0zf7R8tk4rfA1vm4fAHeZ1QoVEOo.jpeg",
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/799.jpg-0tEi4Xvg5YsFoGoQfQc698q4Dygl1S.jpeg",
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/9334228.jpg-eOsHCkvVrVAwcPHKYSs5sQwVKsqWpC.jpeg",
]

export default function SettingsPage() {
  const { settings, updateSettings, updateNotificationSettings, updatePrivacySettings } = useSettings()
  const [selectedAvatar, setSelectedAvatar] = useState(settings.avatar)
  const { language } = useLanguage()

  // 添加翻译对象
  const translations = {
    en: {
      accountSettings: "Account Settings",
      profile: "Profile",
      security: "Security",
      preferences: "Preferences",
      notifications: "Notifications",
      privacy: "Privacy",
      profileSettings: "Profile Settings",
      manageAccountInfo: "Manage your account information",
      currentAvatar: "Current Avatar",
      chooseNewAvatar: "Choose a new avatar",
      uploadCustomAvatar: "Or upload a custom avatar",
      fullName: "Full Name",
      email: "Email",
      phoneNumber: "Phone Number",
      timezone: "Timezone",
      saveProfileSettings: "Save Profile Settings",
      settingsSavedSuccess: "Account settings saved successfully",
      notificationsSavedSuccess: "Notification settings saved successfully",
      privacySavedSuccess: "Privacy settings saved successfully",
      // 安全设置相关
      securitySettings: "Security Settings",
      manageSecuritySettings: "Manage your account's security settings",
      currentPassword: "Current Password",
      newPassword: "New Password",
      confirmNewPassword: "Confirm New Password",
      enableTwoFactor: "Enable Two-Factor Authentication",
      saveSecuritySettings: "Save Security Settings",
      loginHistory: "Login History",
      recentLoginActivities: "Recent login activities on your account",
      dataProtection: "Data Protection",
      manageGeneticDataSecurity: "Manage genetic data security",
      enhancedDataEncryption: "Enhanced Data Encryption",
      applyAdditionalEncryption: "Apply additional encryption to your genetic data",
      automaticDataBackup: "Automatic Data Backup",
      regularlyBackupData: "Regularly backup your genetic data and reports",
      loginNotifications: "Login Notifications",
      receiveLoginNotifications: "Receive notifications when your account is accessed",
      // 偏好设置相关
      customizeExperience: "Customize your genetic dashboard experience",
      language: "Language",
      measurementUnits: "Measurement Units",
      metric: "Metric (cm, kg)",
      imperial: "Imperial (in, lb)",
      dateFormat: "Date Format",
      fontSize: "Font Size",
      theme: "Theme",
      light: "Light",
      dark: "Dark",
      system: "System",
      dashboardLayout: "Dashboard Layout",
      default: "Default",
      compact: "Compact",
      expanded: "Expanded",
      savePreferences: "Save Preferences",
      // 通知设置相关
      notificationSettings: "Notification Settings",
      manageNotifications: "Manage how you receive notifications",
      notificationChannels: "Notification Channels",
      emailNotifications: "Email Notifications",
      pushNotifications: "Push Notifications",
      smsNotifications: "SMS Notifications",
      notificationTypes: "Notification Types",
      newReportsAvailable: "New Reports Available",
      dnaRelativeMatches: "DNA Relative Matches",
      researchUpdates: "Research Updates",
      securityAlerts: "Security Alerts",
      notificationFrequency: "Notification Frequency",
      realTime: "Real-time",
      dailyDigest: "Daily Digest",
      weeklySummary: "Weekly Summary",
      quietHours: "Quiet Hours",
      to: "to",
      saveNotificationSettings: "Save Notification Settings",
      // 隐私设置相关
      privacySettings: "Privacy Settings",
      managePrivacySettings: "Manage your privacy and data settings",
      dataSharing: "Data Sharing",
      shareAnalyticsData: "Share analytics data",
      participateInResearch: "Participate in research",
      profileVisibility: "Profile Visibility",
      public: "Public",
      private: "Private",
      dataRetention: "Data Retention",
      selectDataRetentionPeriod: "Select Data Retention Period",
      sixMonths: "6 Months",
      oneYear: "1 Year",
      twoYears: "2 Years",
      indefinite: "Indefinite",
      dataExport: "Data Export",
      downloadDataCopy: "Download a copy of all your genetic data and reports",
      exportAllData: "Export All Data",
      downloadYourData: "Download Your Data",
      deleteMyAccount: "Delete My Account",
      savePrivacySettings: "Save Privacy Settings",
    },
    "zh-CN": {
      accountSettings: "账户设置",
      profile: "个人资料",
      security: "安全",
      preferences: "偏好设置",
      notifications: "通知",
      privacy: "隐私",
      profileSettings: "个人资料设置",
      manageAccountInfo: "管理您的账户信息",
      currentAvatar: "当前头像",
      chooseNewAvatar: "选择新头像",
      uploadCustomAvatar: "或上传自定义头像",
      fullName: "全名",
      email: "电子邮箱",
      phoneNumber: "电话号码",
      timezone: "时区",
      saveProfileSettings: "保存个人资料设置",
      settingsSavedSuccess: "账户设置保存成功",
      notificationsSavedSuccess: "通知设置保存成功",
      privacySavedSuccess: "隐私设置保存成功",
      // 安全设置相关
      securitySettings: "安全设置",
      manageSecuritySettings: "管理您的账户安全设置",
      currentPassword: "当前密码",
      newPassword: "新密码",
      confirmNewPassword: "确认新密码",
      enableTwoFactor: "启用双因素认证",
      saveSecuritySettings: "保存安全设置",
      loginHistory: "登录历史",
      recentLoginActivities: "您账户的最近登录活动",
      dataProtection: "数据保护",
      manageGeneticDataSecurity: "管理基因数据安全",
      enhancedDataEncryption: "增强数据加密",
      applyAdditionalEncryption: "对您的基因数据应用额外加密",
      automaticDataBackup: "自动数据备份",
      regularlyBackupData: "定期备份您的基因数据和报告",
      loginNotifications: "登录通知",
      receiveLoginNotifications: "当您的账户被访问时接收通知",
      // 偏好设置相关
      customizeExperience: "自定义您的基因仪表板体验",
      language: "语言",
      measurementUnits: "计量单位",
      metric: "公制 (厘米, 千克)",
      imperial: "英制 (英寸, 磅)",
      dateFormat: "日期格式",
      fontSize: "字体大小",
      theme: "主题",
      light: "浅色",
      dark: "深色",
      system: "系统",
      dashboardLayout: "仪表板布局",
      default: "默认",
      compact: "紧凑",
      expanded: "展开",
      savePreferences: "保存偏好设置",
      // 通知设置相关
      notificationSettings: "通知设置",
      manageNotifications: "管理您接收通知的方式",
      notificationChannels: "通知渠道",
      emailNotifications: "电子邮件通知",
      pushNotifications: "推送通知",
      smsNotifications: "短信通知",
      notificationTypes: "通知类型",
      newReportsAvailable: "新报告可用",
      dnaRelativeMatches: "DNA亲缘匹配",
      researchUpdates: "研究更新",
      securityAlerts: "安全警报",
      notificationFrequency: "通知频率",
      realTime: "实时",
      dailyDigest: "每日摘要",
      weeklySummary: "每周总结",
      quietHours: "安静时段",
      to: "至",
      saveNotificationSettings: "保存通知设置",
      // 隐私设置相关
      privacySettings: "隐私设置",
      managePrivacySettings: "管理您的隐私和数据设置",
      dataSharing: "数据共享",
      shareAnalyticsData: "共享分析数据",
      participateInResearch: "参与研究",
      profileVisibility: "个人资料可见性",
      public: "公开",
      private: "私密",
      dataRetention: "数据保留",
      selectDataRetentionPeriod: "选择数据保留期限",
      sixMonths: "6个月",
      oneYear: "1年",
      twoYears: "2年",
      indefinite: "无限期",
      dataExport: "数据导出",
      downloadDataCopy: "下载您所有基因数据和报告的副本",
      exportAllData: "导出所有数据",
      downloadYourData: "下载您的数据",
      deleteMyAccount: "删除我的账户",
      savePrivacySettings: "保存隐私设置",
    }
  }

  // 翻译函数
  const t = (key: keyof typeof translations['en']) => {
    return translations[language][key] || key
  }

  const handleSaveAccount = () => {
    updateSettings({
      avatar: selectedAvatar,
      fullName: settings.fullName,
      email: settings.email,
      phone: settings.phone,
      timezone: settings.timezone,
    })
    toast.success(t("settingsSavedSuccess"))
  }

  const handleSaveNotifications = () => {
    updateNotificationSettings(settings.notifications)
    toast.success(t("notificationsSavedSuccess"))
  }

  const handleSavePrivacy = () => {
    updatePrivacySettings(settings.privacy)
    toast.success(t("privacySavedSuccess"))
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">{t("accountSettings")}</h1>
      <Tabs defaultValue="account" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="account">{t("profile")}</TabsTrigger>
          <TabsTrigger value="security">{t("security")}</TabsTrigger>
          <TabsTrigger value="preferences">{t("preferences")}</TabsTrigger>
          <TabsTrigger value="notifications">{t("notifications")}</TabsTrigger>
          <TabsTrigger value="privacy">{t("privacy")}</TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>{t("profileSettings")}</CardTitle>
              <CardDescription>{t("manageAccountInfo")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>{t("currentAvatar")}</Label>
                <div className="flex items-center space-x-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={selectedAvatar} alt={settings.fullName} />
                    <AvatarFallback>
                      {settings.fullName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <Label>{t("chooseNewAvatar")}</Label>
                {/* 头像选择部分保持不变 */}
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {defaultAvatars.map((avatar, index) => (
                    <Avatar
                      key={index}
                      className={`h-20 w-20 rounded-lg cursor-pointer hover:ring-2 hover:ring-primary shrink-0 ${
                        selectedAvatar === avatar ? "ring-2 ring-primary" : ""
                      }`}
                      onClick={() => setSelectedAvatar(avatar)}
                    >
                      <AvatarImage src={avatar} alt={`Avatar ${index + 1}`} className="object-cover" />
                      <AvatarFallback>{index + 1}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <div>
                  <Label htmlFor="custom-avatar">{t("uploadCustomAvatar")}</Label>
                  <Input id="custom-avatar" type="file" accept="image/*" className="mt-1" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="full-name">{t("fullName")}</Label>
                <Input
                  id="full-name"
                  value={settings.fullName}
                  onChange={(e) => updateSettings({ fullName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={settings.email}
                  onChange={(e) => updateSettings({ email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t("phoneNumber")}</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={settings.phone}
                  onChange={(e) => updateSettings({ phone: e.target.value })}
                />
              </div>
              {/* 时区选择保持不变，但标签文本使用翻译 */}
              <div className="space-y-2">
                <Label htmlFor="timezone">{t("timezone")}</Label>
                <Select value={settings.timezone} onValueChange={(value) => updateSettings({ timezone: value })}>
                  <SelectTrigger id="timezone">
                    <SelectValue placeholder={t("timezone")} />
                  </SelectTrigger>
                  <SelectContent>
                    {/* 时区选项保持不变 */}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveAccount}>{t("saveProfileSettings")}</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* 其他标签页内容也需要类似的翻译处理 */}
        {/* 安全设置标签页 */}
        <TabsContent value="security">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>{t("securitySettings")}</CardTitle>
                <CardDescription>{t("manageSecuritySettings")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">{t("currentPassword")}</Label>
                  <Input id="current-password" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">{t("newPassword")}</Label>
                  <Input id="new-password" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">{t("confirmNewPassword")}</Label>
                  <Input id="confirm-password" type="password" />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="two-factor" />
                  <Label htmlFor="two-factor">{t("enableTwoFactor")}</Label>
                </div>
              </CardContent>
              <CardFooter>
                <Button>{t("saveSecuritySettings")}</Button>
              </CardFooter>
            </Card>

            {/* 其余安全设置卡片也需要类似处理 */}
            {/* ... */}
          </div>
        </TabsContent>

        {/* 其他标签页内容也需要类似处理 */}
        {/* ... */}

        {/* 隐私设置标签页 */}
        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Eye className="mr-2 h-5 w-5" />
                {t("privacySettings")}
              </CardTitle>
              <CardDescription>{t("managePrivacySettings")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 隐私设置内容也需要类似处理 */}
              {/* ... */}
            </CardContent>
            <CardFooter>
              <Button onClick={handleSavePrivacy}>{t("savePrivacySettings")}</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

