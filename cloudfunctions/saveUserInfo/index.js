const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  const db = cloud.database()
  const { collection, data } = event

  // 验证必要参数
  if (!collection || !data) {
    return {
      code: 400,
      message: '缺少必要参数: collection'
    }
  }

  try {
    // 检查是否已存在记录 - 兼容两种查询方式
    let queryCondition = {}
    
    // 支持 summary.js 中使用的 _openid 查询
    if (data._openid) {
      queryCondition._openid = data._openid
    } 
    // 支持 information.js 中使用的 userId 查询
    else if (data.userId) {
      queryCondition.userId = data.userId
    }
    // 如果都没有，则使用默认的 OPENID
    else {
      const wxContext = cloud.getWXContext()
      queryCondition._openid = wxContext.OPENID
    }
    
    const queryRes = await db.collection(collection)
      .where(queryCondition)
      .get()

    let result
    if (queryRes.data && queryRes.data.length > 0) {
      // 更新现有记录
      result = await db.collection(collection)
        .doc(queryRes.data[0]._id)
        .update({
          data: {
            ...data,
            updateTime: db.serverDate()
          }
        })
      
      return {
        code: 0,
        message: '更新成功',
        data: {
          ...result,
          _id: queryRes.data[0]._id
        }
      }
    } else {
      // 添加新记录
      const completeData = {
        ...data,
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        _status: 'active'
      }
      
      // 确保有 _openid 字段
      if (!completeData._openid) {
        const wxContext = cloud.getWXContext()
        completeData._openid = wxContext.OPENID
      }
      
      result = await db.collection(collection).add({
        data: completeData
      })
      
      return {
        code: 0,
        message: '创建成功',
        data: result
      }
    }
  } catch (err) {
    console.error('数据库操作失败:', err)
    return {
      code: 500,
      message: '服务器内部错误',
      data: {
        errMsg: err.message || '未知错误'
      }
    }
  }
}