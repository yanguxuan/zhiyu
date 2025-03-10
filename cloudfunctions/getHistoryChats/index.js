const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    const db = cloud.database();

    const query = event.chatId ? 
      { _id: event.chatId } : 
      { _openid: event.openid || wxContext.OPENID };

    const history = await db.collection('chatHistory')
      .where(query)
      .get();

    if (history.data.length > 0) {
      return { 
        code: 0, 
        data: event.chatId ? history.data[0] : history.data 
      };
    }
    return { code: 1, message: '未找到对话记录' };
  } catch (error) {
    console.error('数据库错误:', error);
    return { 
      code: 500, 
      message: `服务错误: ${error.message}` 
    };
  }
};