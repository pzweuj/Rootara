import React from 'react';
import Characteristics from './Characters/Characteristics';

interface GenotypeData {
    rsid: string;
    genotype: string;
}

const TEST_GENOTYPES: GenotypeData[] = [
    { rsid: "rs1229984", genotype: "GA" },  // ADH1B - 中等代谢型
    { rsid: "rs671", genotype: "GG" }       // ALDH2 - 正常代谢型
];

async function getCharacteristics() {
    const response = await fetch('/public/lib/characteristics');
    if (!response.ok) {
        throw new Error(`网络错误：${response.status}`);
    }
    const files = await response.json(); // 假设服务器返回文件列表
    const markdownFiles: string[] = files.filter((file: string) => file.endsWith('.md')); // 指定类型为字符串数组

    return Promise.all(
        markdownFiles.map(async (filename: string) => { // 指定参数类型为字符串
            const fileResponse = await fetch(`/lib/characteristics/${filename}`);
            if (!fileResponse.ok) {
                throw new Error(`文件未找到：${filename}`);
            }
            const content = await fileResponse.text();

            return {
                id: filename.replace('.md', ''),
                content,
            };
        })
    );
}

export default async function CharacterAnalysis() {
    const characteristics = await getCharacteristics();

    return (
        <div className="character-analysis">
            <h2 className="text-2xl font-bold mb-4">基因特征分析</h2>
            <div className="grid gap-4">
                {characteristics.map((characteristic) => (
                    <div key={characteristic.id} className="bg-white rounded-lg shadow p-6">
                        <Characteristics
                            content={characteristic.content}
                            genotypes={TEST_GENOTYPES}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}