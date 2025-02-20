// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: 'zhiyu-1gumpjete2a88c59'
})

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  
  const { action, userInfo } = event
  
  try {
    switch (action) {
      case 'get':
        // 获取用户信息
        const user = await db.collection('user_info')
          .where({
            _openid: wxContext.OPENID
          })
          .get()
        return {
          data: user.data[0] || null
        }
        
      case 'update':
        // 更新用户信息
        const { avatarUrl, nickName } = userInfo
        
        const existingUser = await db.collection('user_info')
          .where({
            _openid: wxContext.OPENID
          })
          .get()
          
        if (existingUser.data.length > 0) {
          // 更新现有用户
          await db.collection('user_info')
            .where({
              _openid: wxContext.OPENID
            })
            .update({
              data: {
                avatarUrl,
                nickName,
                updateTime: db.serverDate()
              }
            })
        } else {
          // 创建新用户
          await db.collection('user_info')
            .add({
              data: {
                _openid: wxContext.OPENID,
                avatarUrl,
                nickName,
                createTime: db.serverDate(),
                updateTime: db.serverDate()
              }
            })
        }
        
        return {
          success: true
        }
        
      default:
        return {
          error: '未知的操作类型'
        }
    }
  } catch (err) {
    console.error(err)
    return {
      error: err.message
    }
  }
} 