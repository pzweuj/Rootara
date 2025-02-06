import React from 'react';

interface Genotypes {
  [rsid: string]: string;
}

interface Locus {
  rsid: string;
  gene: string;
  genotype: string;
}

interface ConclusionDetails {
  title: string;
  description: string;
  suggestions: string[];
}

interface ParseResult {
  projectName: string;
  projectDescription: string;
  loci: Locus[];
  metabolismLevel: string;
  conclusion: string;
  conclusionDetails: ConclusionDetails;
}

interface Props {
  genotypes: Genotypes;
  markdownPath: string;
}

const MetabolismParser: React.FC<Props> = ({ genotypes, markdownPath }) => {
  const [markdownFile, setMarkdownFile] = React.useState<string>('');
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchMarkdown = async () => {
      try {
        const response = await fetch(markdownPath);
        if (!response.ok) {
          throw new Error(`Failed to fetch markdown: ${response.statusText}`);
        }
        const text = await response.text();
        setMarkdownFile(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : '未知错误');
      } finally {
        setLoading(false);
      }
    };

    fetchMarkdown();
  }, [markdownPath]);

  if (loading) return <div>加载中...</div>;
  if (error) return <div>错误: {error}</div>;

  // 跳过元数据部分，直接解析正文
  const content = markdownFile.replace(/---[\s\S]*?---/, '').trim();

  // 提取项目信息
  const projectNameMatch = content.match(/# (.*)\n/);
  const projectName = projectNameMatch ? projectNameMatch[1] : '未知项目';
  
  const projectDescriptionMatch = content.match(/## 项目描述\n(.*)\n(##|$)/);
  const projectDescription = projectDescriptionMatch ? projectDescriptionMatch[1] : '无项目描述';

  // 提取参考文献（如果存在）
  const references = content.match(/## 参考文献\n([\s\S]*)/)?.[1] || '';

  // 提取检测位点
  const loci: Locus[] = [...content.matchAll(/### (.*)\n基因: (.*)\n/g)].map(match => ({
    rsid: match[1],
    gene: match[2],
    genotype: genotypes[match[1]] || '未检测'
  }));

  // 提取计算规则
  const calculateFunctionMatch = content.match(/```javascript([\s\S]*?)```/);
  if (!calculateFunctionMatch) {
    throw new Error('未找到计算规则');
  }
  
  // 添加调试信息
  console.log('提取的计算函数:', calculateFunctionMatch[1]);
  
  // 在try块外部声明变量
  let metabolismLevel: string;

  try {
    console.log('原始基因型数据:', genotypes);
    console.log('提取的计算函数代码:', calculateFunctionMatch[1]);
    
    // 使用Function构造函数创建计算函数
    const calculateFunction = new Function('genotypes', `
      ${calculateFunctionMatch[1]}
      return calculate(genotypes);
    `) as (genotypes: Genotypes) => string;
    
    // 计算代谢能力
    metabolismLevel = calculateFunction(genotypes);
    console.log('计算结果:', metabolismLevel);
    
    // 添加验证
    if (!metabolismLevel || !['high', 'medium', 'low'].includes(metabolismLevel)) {
      throw new Error(`无效的代谢能力等级: ${metabolismLevel}`);
    }
  } catch (err) {
    console.error('计算函数执行错误:', err);
    throw new Error(`计算函数执行失败: ${err instanceof Error ? err.message : '未知错误'}`);
  }

  // 提取结论信息
  const conclusionSectionMatch = markdownFile.match(/## 结论库\n([\s\S]*)/);
  const conclusionSection = conclusionSectionMatch?.[1] || '';
  
  // 查找对应结论
  let conclusionDetailsMatch = null;
  if (conclusionSection) {
    conclusionDetailsMatch = conclusionSection.match(
      new RegExp(`### ${metabolismLevel}\n标题: (.*?)\n描述: (.*?)\n建议:\n([\\s\\S]*?)(\n###|$)`)
    );
  }

  // 添加调试信息
  console.log('结论库内容:', conclusionSection);
  console.log('匹配到的结论信息:', conclusionDetailsMatch);
  
  // 默认结论信息
  const defaultConclusion = {
    title: '结论信息未找到',
    description: '无法找到与当前代谢能力等级对应的结论信息',
    suggestions: ['请咨询专业医生获取建议']
  };

  const result: ParseResult = {
    projectName,
    projectDescription,
    loci,
    metabolismLevel,
    conclusion: conclusionDetailsMatch ? conclusionDetailsMatch[1] : defaultConclusion.title,
    conclusionDetails: {
      title: conclusionDetailsMatch ? conclusionDetailsMatch[1] : defaultConclusion.title,
      description: conclusionDetailsMatch ? conclusionDetailsMatch[2] : defaultConclusion.description,
      suggestions: conclusionDetailsMatch ? 
        conclusionDetailsMatch[3].trim().split('\n').map((s: string) => s.replace(/^  - /, '').trim()) :
        defaultConclusion.suggestions
    }
  };

  return (
    <div>
      <h1>{result.projectName}</h1>
      <p>{result.projectDescription}</p>
      <h2>检测结果</h2>
      <p>{result.projectName}: {result.metabolismLevel}</p>
      <h3>结论</h3>
      <p>{result.conclusion}</p>
      <h4>建议</h4>
      <ul>
        {result.conclusionDetails.suggestions.map((suggestion, index) => (
          <li key={index}>{suggestion}</li>
        ))}
      </ul>
      {references && (
        <div>
          <h4>参考文献</h4>
          <div dangerouslySetInnerHTML={{ __html: references }} />
        </div>
      )}
    </div>
  );
};

export default MetabolismParser;