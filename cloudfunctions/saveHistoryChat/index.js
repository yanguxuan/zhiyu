const cloud = require('wx-server-sdk')
cloud.init({ env: process.env.ENV_ID || 'zhiyu-1gumpjete2a88c59' })

exports.main = async (event) => {
  const db = cloud.database()
  const _ = db.command

  try {
    if (!event.chatId) throw new Error('缺少chatId参数')

    if (event.action === 'update') {
      return await db.collection('chatHistory')
        .doc(event.chatId)
        .update({
          data: {
            messages: event.messages,
            updateTime: db.serverDate(),
            metadata: {
              lastStage: event.metadata?.stage,
              lastBotId: event.metadata?.botId
            }
          }
        })
    }

    if (event.action === 'create') {
      return await db.collection('chatHistory').add({
        data: {
          _id: event.chatId,
          openid: event.userInfo.openid,
          createTime: db.serverDate(),
          messages: [],
          metadata: {
            initStage: AGENT_CONFIG.COLLECT.name
          }
        }
      })
    }

    throw new Error('无效的操作类型')
  } catch (error) {
    console.error('云函数执行错误:', error)
    return {
      code: -1,
      message: error.message,
      errorDetail: error
    }
  }
}