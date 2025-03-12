// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  // 获取要删除的聊天ID
  const { chatId, deleteReport = false } = event
  
  if (!chatId) {
    return {
      code: 1,
      message: '无效的聊天ID'
    }
  }
  
  try {
    console.log(`开始删除聊天记录: ${chatId}`);
    
    // 删除聊天记录
    await db.collection('chats').doc(chatId).remove()
    console.log(`聊天记录删除成功: ${chatId}`);
    
    // 如果需要删除关联的报告
    if (deleteReport) {
      console.log(`查询关联的报告: ${chatId}`);
      const reports = await db.collection('reports')
        .where({
          chatId: chatId
        })
        .get()
      
      console.log(`找到 ${reports.data.length} 个关联报告`);
      
      if (reports && reports.data && reports.data.length > 0) {
        for (const report of reports.data) {
          console.log(`删除报告: ${report._id}`);
          await db.collection('reports').doc(report._id).remove()
        }
      }
    }
    
    return {
      code: 0,
      message: '删除成功'
    }
  } catch (error) {
    console.error('删除失败:', error)
    return {
      code: 500,
      message: '删除失败: ' + error.message,
      error: error
    }
  }
}