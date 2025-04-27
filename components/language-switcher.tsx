"use client"

import { useLanguage } from "@/contexts/language-context"
import { Button } from "@/components/ui/button"

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage()

  const toggleLanguage = () => {
    // 在英文和简体中文之间切换
    setLanguage(language === "en" ? "zh-CN" : "en")
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggleLanguage}>
      {language === "en" ? (
        <span className="font-bold text-sm">EN</span>
      ) : (
        <span className="font-bold text-sm">中</span>
      )}
      <span className="sr-only">{t("language")}</span>
    </Button>
  )
}
