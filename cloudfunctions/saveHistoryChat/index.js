// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action, chatId, userInfo, messages, title, lastMessage, updateTime, hasSummary } = event
  
  try {
    if (action === 'create') {
      // 创建新对话
      return await db.collection('chatHistory').add({
        data: {
          _id: chatId,
          openid: wxContext.OPENID,
          userInfo,
          messages: messages || [],
          title: title || '新对话',
          lastMessage: lastMessage || '',
          createTime: db.serverDate(),
          updateTime: db.serverDate(),
          hasSummary: false // 初始化为false
        }
      })
    } else if (action === 'update') {
      // 更新现有对话
      return await db.collection('chatHistory').doc(chatId).update({
        data: {
          messages,
          title: title || '未命名对话',
          lastMessage: lastMessage || '',
          updateTime: db.serverDate(),
          hasSummary: hasSummary || false // 添加hasSummary字段
        }
      })
    }
  } catch (error) {
    console.error(error)
    return {
      code: -1,
      message: error.message
    }
  }
}