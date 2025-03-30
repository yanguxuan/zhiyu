const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  const db = cloud.database()
  const { collection, data } = event

  // 验证必要参数
  if (!collection || !data || !data.userId) {
    return {
      code: 400,
      message: '缺少必要参数: collection或userId'
    }
  }

  try {
    // 检查是否已存在记录
    const queryRes = await db.collection(collection)
      .where({
        userId: data.userId
      })
      .get()

    let result
    if (queryRes.data.length > 0) {
      // 更新现有记录
      result = await db.collection(collection)
        .doc(queryRes.data[0]._id)
        .update({
          data: {
            ...data,
            updateTime: db.serverDate()
          }
        })
    } else {
      // 添加新记录
      const completeData = {
        ...data,
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        _status: 'active'
      }
      result = await db.collection(collection).add({
        data: completeData
      })
    }

    return {
      code: 0,
      message: '操作成功',
      data: result
    }
  } catch (err) {
    console.error('数据库操作失败:', err)
    return {
      code: 500,
      message: '服务器内部错误',
      data: {
        errMsg: err.message
      }
    }
  }
}