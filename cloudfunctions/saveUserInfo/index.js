// cloudfunctions/saveUserInfo/index.js
const cloud = require('wx-server-sdk')

// 初始化云环境（自动继承当前环境）
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  const db = cloud.database()
  const { collection, data } = event

  try {
    // 添加系统字段
    const completeData = {
      ...data,
      createTime: db.serverDate(),    // 服务端时间戳
      updateTime: db.serverDate(),
      _status: 'active'               // 软删除标记
    }

    // 执行数据库插入
    const res = await db.collection(collection).add({
      data: completeData
    })

    // 返回标准格式
    return {
      code: 0,
      message: '保存成功',
      data: {
        _id: res._id,
        createTime: completeData.createTime
      }
    }
  } catch (err) {
    console.error('数据库写入失败:', err)
    return {
      code: 5001,
      message: '数据保存失败，请检查网络后重试',
      data: {
        errMsg: err.errMsg || '未知错误'
      }
    }
  }
}