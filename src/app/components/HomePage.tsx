export default function HomePage() {
  return (
    <div>
      <img src="/logo.png" alt="Rootara Logo" style={{ width: '200px', marginBottom: '20px' }} />
      
      <h1>欢迎来到 Rootara</h1>
      
      <section style={{ marginBottom: '30px' }}>
        <h2>项目简介</h2>
        <p>
          Rootara 是一个自托管的遗传基因检测结果分析平台，旨在帮助用户更好地管理自己的基因检测结果。
          通过 Rootara，您可以上传来自不同基因检测服务商的数据，挖掘自身的遗传信息，发现潜在的遗传疾病风险，
          并探索家族遗传特征。
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>主要功能</h2>
        <ul>
          <li>祖源分析 - 探索您的家族起源</li>
          <li>遗传性疾病 - 了解潜在的健康风险</li>
          <li>药物反应 - 个性化用药指导</li>
          <li>遗传特征 - 发现独特的身体特征</li>
          <li>自定义报告 - 创建个性化的基因分析</li>
        </ul>
      </section>

      <section>
        <h2>开始使用</h2>
        <p>
          要开始使用 Rootara，请先上传您的基因检测数据。我们支持多种格式的文件上传，
          包括 23andMe、WeGene 等主流基因检测公司的数据格式。
        </p>
      </section>
    </div>
  );
}