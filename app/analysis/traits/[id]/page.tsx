import { redirect } from "next/navigation"

export default async function LegacyTraitPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/analysis/traits/detail?id=${encodeURIComponent(id)}`)
}
