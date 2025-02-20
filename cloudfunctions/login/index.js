// cloudfunctions/login/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  
  try {
    // 检查用户是否已存在
    const { data } = await db.collection('users')
      .where({
        _openid: wxContext.OPENID
      })
      .get()
    
    // 如果用户不存在，创建新用户
    if (!data.length) {
      await db.collection('users').add({
        data: {
          _openid: wxContext.OPENID,
          createdAt: db.serverDate()
        }
      })
    }
    
    return {
      openid: wxContext.OPENID,
      appid: wxContext.APPID,
      unionid: wxContext.UNIONID,
    }
  } catch (err) {
    console.error(err)
    return {
      error: err.message
    }
  }
}