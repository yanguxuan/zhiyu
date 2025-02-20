// 引入云开发 SDK
const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
});

// 云函数入口函数
exports.main = async (event, context) => {
    console.log('云函数开始执行，输入参数:', event);

    try {
        // 获取微信上下文
        const wxContext = cloud.getWXContext();
        // 获取数据库引用
        const db = cloud.database();

        // 获取 openid，优先使用传入的 openid，若没有则使用上下文的 openid
        const openid = event.openid || wxContext.OPENID;

        // 查询历史对话记录
        const history = await db.collection('chat_history')
           .where({
                _openid: openid
            })
           .get();

        if (history.data.length > 0) {
            console.log('成功获取历史对话记录:', history.data);
            return { code: 0, data: history.data };
        } else {
            console.log('未找到该用户的对话记录，openid:', openid);
            return { code: 1, message: '未找到该用户的对话记录' };
        }
    } catch (error) {
        console.error('获取历史对话记录时数据库出错，错误类型:', error.name, '错误信息:', error.message, '错误堆栈:', error.stack);
        return { code: 500, message: `获取历史对话记录时数据库出错: ${error.message}` };
    } finally {
        console.log('云函数执行结束');
    }
};