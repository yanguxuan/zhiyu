const cloud = require('wx-server-sdk');
const { pipeline } = require('@xenova/transformers');
const { cosineSimilarity } = require('./utils'); // 假设把余弦相似度计算等相关工具函数提取到单独的 utils 文件中

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
});

// 加载分词器和模型，这里路径需要根据实际情况确认是否正确配置
const modelCloudBasePath = 'cloud://zhiyu-1gumpjete2a88c59.7a68-zhiyu-1gumpjete2a88c59-1339882768/bert-base-chinese-local';

async function textToVector(text) {
    const extractor = await pipeline('feature-extraction', modelCloudBasePath);
    if (!extractor) {
        throw new Error('特征提取器创建失败');
    }
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    if (!output ||!output.data) {
        throw new Error('特征提取结果无效');
    }
    return output.data;
}

exports.main = async (event, context) => {
    const { query, limit = 3 } = event;
    if (typeof query!== 'string' || query.trim() === '') {
        return {
            code: -1,
            error: '查询文本必须是有效的字符串且不能为空'
        };
    }
    try {
        const queryVector = await textToVector(query);
        const results = [];
        const db = cloud.database();
        for (const collectionName of ['knowledge', 'knowledge-2']) {
            const collection = db.collection(collectionName);
            const data = (await collection.get()).data;
            for (const record of data) {
                if (record.embedding && Array.isArray(record.embedding)) {
                    const similarity = cosineSimilarity(queryVector, record.embedding);
                    record.similarity = similarity;
                    results.push(record);
                }
            }
        }
        results.sort((a, b) => b.similarity - a.similarity);
        const finalResults = results.slice(0, limit);
        return {
            code: 0,
            data: finalResults
        };
    } catch (error) {
        return {
            code: -1,
            error: error.message
        };
    }
};