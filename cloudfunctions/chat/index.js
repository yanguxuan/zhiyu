const cloud = require('wx-server-sdk');
const { ZhipuAI } = require('zhipuai');

// 云函数初始化
cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
});

// 配置智谱AI客户端
const config = {
    apiKey: ''
};

// 初始化智谱AI客户端
const client = new ZhipuAI({
    apiKey: config.apiKey
});

// 系统提示词
const SYSTEM_PROMPT = `你是一位知心阿姨，带有赵本山式的唠嗑风格
我是一个6 - 18岁的孩子的家长,你是我的好朋友
我的孩子每天会经历各种事情和情绪活动,我遇到事情会找你寻求帮助。
而你会根据以下的情绪教导理论进行帮助：
1.可以通过多轮对话询问来获取信息，如：(1)孩子的年龄(2)我关于孩子的困扰等，来使建议更加有效
2.亲子之间有沟通问题，也可能是家长的态度，语气等有问题。可以引导我对自己行为反思
3.提供具体的、有帮助的、对我无害的建议使我的问题得以解决。
要求:
    1.你的每个回复都不会超过70字
    2.可以通过询问孩子的习惯，是否经历过某些事来推断孩子出现异常行为的原因
    3.你的回答要言简意赅，自然流畅，语重心长，富有温度
    4.每次最多问一个问题
    5.可以委婉，有道理的指出家长一些做法的不当之处，并给出可能的补救措施
    6.灵活参照数据库中的示例`;

// 去除引号和反斜杠的函数
function removeQuotes(str) {
    // 去除反斜杠
    str = str.replace(/\\/g, '');
    // 去除首尾引号
    str = str.replace(/^['"]|['"]$/g, '');
    return str;
}

// 云函数入口函数
exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext();
    const db = cloud.database();

    try {
        // 获取用户输入的消息
        const message = event.message;

        // 验证消息是否为空
        if (!message || typeof message!== 'string' || message.trim() === '') {
            return {
                code: -1,
                error: '用户输入的消息不能为空，请重新输入。',
                data: null
            };
        }

        // 去除消息前后的空格
        const trimmedMessage = message.trim();

        // 搜索相关的知识库记录
        let relatedKnowledge = [];
        try {
            const { result } = await cloud.callFunction({
                name: 'searchRelatedMessages',
                data: {
                    query: trimmedMessage,
                    limit: 3
                }
            });

            if (result && result.code === 0 && result.data) {
                relatedKnowledge = result.data.map(item => ({
                    sentence: item.sentence,
                    similarity: Number(item.similarity.toFixed(4))
                }));
            }
        } catch (searchErr) {
            console.error('搜索相关知识时出错:', searchErr);
        }

        // 构建上下文提示
        let contextPrompt = '';
        if (relatedKnowledge.length > 0) {
            contextPrompt = '以下是一些相关的参考案例：\n' +
                relatedKnowledge.map(item => 
                    `句子：${item.sentence}`
                ).join('\n\n') + '\n\n';
        }

        // 获取当前用户的最近对话记录
        const history = await db.collection('chatHistory')
           .where({
                _openid: wxContext.OPENID
            })
           .orderBy('createdAt', 'desc')
           .limit(5)
           .get();

        let historyMessages = history.data.map(chat => ({
            role: "user",
            content: chat.message
        })).reverse();

        // 构建要发送给智谱AI的消息列表
        const messages = [
            {
                role: "system",
                content: SYSTEM_PROMPT + '\n\n' + contextPrompt
            },
            ...historyMessages,
            {
                role: "user",
                content: trimmedMessage
            }
        ];

        // 打印要发送的消息列表到控制台
        console.log('即将发送给智谱AI的消息列表:', messages);

        // 生成回复
        let completion;
        try {
            completion = await client.invoke({
                model: "glm-4-flash",
                messages: messages,
                temperature: 0
            });
        } catch (invokeErr) {
            console.error('调用智谱AI时出错:', invokeErr);
            return {
                code: -1,
                error: `调用AI服务出错: ${invokeErr.message}`,
                data: null
            };
        }

        // 提取AI回复内容并处理多余的引号和反斜杠
        let aiResponse = completion.choices[0].content.trim();
        aiResponse = removeQuotes(aiResponse);

        // 保存对话记录
        const chatRecord = {
            _openid: wxContext.OPENID,
            message: trimmedMessage,
            response: aiResponse,
            createdAt: db.serverDate(),
            relatedKnowledge: relatedKnowledge
        };

        try {
            await db.collection('chatHistory').add({
                data: chatRecord
            });
            console.log('成功保存对话记录');
        } catch (saveErr) {
            console.error('保存对话记录时出错:', saveErr);
            let errorMsg = `保存对话记录失败: 错误码 ${saveErr.errCode || '未知'}, 错误信息 ${saveErr.errMsg || saveErr.message}`;
            return {
                code: -1,
                error: errorMsg,
                data: null
            };
        }

        // 返回标准化的响应格式
        return {
            code: 0,
            error: null,
            data: {
                response: aiResponse,
                relatedKnowledge: relatedKnowledge,
                timestamp: Date.now()
            }
        };

    } catch (generalErr) {
        console.error('云函数执行过程中出现未知错误:', generalErr);
        return {
            code: -1,
            error: `执行出错: ${generalErr.message}`,
            data: null
        };
    }
};
