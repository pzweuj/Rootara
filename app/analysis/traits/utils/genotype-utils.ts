// 从基因报告中获取基因型数据
export const fetchGenotypeData = (rsid: string) => {
  // 这里应该是从基因报告中获取数据的实际逻辑
  // 目前使用模拟数据进行演示
  const mockGenotypes = {
    rs12913832: { reference: "GG", user: "AG" },
    rs1800407: { reference: "CC", user: "CT" },
    rs16891982: { reference: "CC", user: "CC" },
    rs1393350: { reference: "GG", user: "AG" },
    rs4778138: { reference: "GG", user: "AG" },
    rs683: { reference: "CC", user: "CT" },
    rs3827760: { reference: "AA", user: "AG" },
    rs11803731: { reference: "GG", user: "AG" },
    rs713598: { reference: "CC", user: "CG" },
    rs1726866: { reference: "AA", user: "AG" },
    rs10246939: { reference: "TT", user: "CT" },
    rs762551: { reference: "AA", user: "AC" },
    rs2472297: { reference: "CC", user: "CT" },
    rs4988235: { reference: "TT", user: "CT" },
    rs182549: { reference: "TT", user: "CT" },
    rs671: { reference: "GG", user: "GG" },
    rs1229984: { reference: "CC", user: "CC" },
    rs73598374: { reference: "CC", user: "CT" },
    rs5751876: { reference: "TT", user: "TC" },
    rs1801260: { reference: "CC", user: "CC" },
    rs228697: { reference: "GG", user: "GG" },
    rs6265: { reference: "GG", user: "AG" },
    rs17070145: { reference: "CC", user: "CT" },
    rs9854612: { reference: "TT", user: "CT" },
    rs4148254: { reference: "GG", user: "GA" },
  }

  if (mockGenotypes[rsid as keyof typeof mockGenotypes]) {
    return mockGenotypes[rsid as keyof typeof mockGenotypes]
  }

  // 如果找不到数据，返回空值
  return { reference: "", user: "" }
}
