// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action, chatId, userInfo, messages, title, lastMessage, createTime } = event
  
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
          createTime: createTime || db.serverDate(),
          updateTime: db.serverDate()
        }
      }).then(() => ({
        code: 0,
        message: '创建成功'
      }))
    } else if (action === 'update') {
      // 更新对话
      return await db.collection('chatHistory').doc(chatId).update({
        data: {
          messages,
          title: title || '对话记录',
          lastMessage: lastMessage || '',
          updateTime: db.serverDate()
        }
      }).then(() => ({
        code: 0,
        message: '更新成功'
      }))
    }
    
    return {
      code: -1,
      message: '未知操作'
    }
  } catch (error) {
    console.error(error)
    return {
      code: -1,
      message: error.message
    }
  }
}