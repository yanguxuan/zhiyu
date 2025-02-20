const cloud = require('wx-server-sdk');
const { DocumentProcessor } = require('node-nlp');

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
});

const processor = new DocumentProcessor();

// 将文本转换为向量
async function textToVector(text) {
    const tokens = await processor.tokenize(text);
    const vector = new Array(100).fill(0); // 使用100维向量
    
    for (const token of tokens) {
        // 使用简单的hash函数将token映射到向量空间
        const hash = token.split('').reduce((acc, char) => {
            return acc + char.charCodeAt(0);
        }, 0);
        
        const index = hash % 100;
        vector[index] += 1;
    }
    
    // 归一化向量
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map(val => magnitude === 0 ? 0 : val / magnitude);
}

// 云函数入口函数
exports.main = async (event, context) => {
    const db = cloud.database();
    
    try {
        // 获取所有未向量化的知识库记录
        const records = await db.collection('knowledge')
            .where({
                vector: null // 没有向量的记录
            })
            .limit(10) // 每次处理10条
            .get();

        if (!records.data || records.data.length === 0) {
            return {
                code: 0,
                message: '没有需要向量化的记录'
            };
        }

        // 处理每条记录
        for (const record of records.data) {
            // 组合问题和回答作为向量化的文本
            const text = `${record.question || ''}\n${record.answer || ''}`;
            
            try {
                // 生成向量
                const vector = await textToVector(text);

                // 更新数据库中的记录，添加向量
                await db.collection('knowledge').doc(record._id).update({
                    data: {
                        vector: vector,
                        vectorized_at: db.serverDate()
                    }
                });

            } catch (error) {
                console.error(`处理记录 ${record._id} 时出错:`, error);
                continue;
            }
        }

        return {
            code: 0,
            message: `成功处理 ${records.data.length} 条记录`
        };

    } catch (error) {
        console.error('向量化处理出错:', error);
        return {
            code: -1,
            error: error.message
        };
    }
}; 