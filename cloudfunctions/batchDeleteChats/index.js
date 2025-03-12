// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  console.log('收到批量删除请求，参数:', event);
  
  // 获取要删除的聊天ID列表
  const { chatIds, deleteReports = false } = event
  
  if (!chatIds || !Array.isArray(chatIds) || chatIds.length === 0) {
    return {
      code: 1,
      message: '无效的聊天ID列表'
    }
  }
  
  try {
    // 批量删除聊天记录
    const deletePromises = chatIds.map(async (chatId) => {
      try {
        await db.collection('chats').doc(chatId).remove();
        console.log(`成功删除聊天: ${chatId}`);
        return { chatId, success: true };
      } catch (err) {
        console.error(`删除聊天失败 ${chatId}:`, err);
        return { chatId, success: false, error: err };
      }
    });
    
    // 如果需要删除关联的报告
    if (deleteReports) {
      try {
        // 查询关联的报告
        const { data: reports } = await db.collection('reports')
          .where({
            chatId: db.command.in(chatIds)
          })
          .get();
        
        console.log(`找到 ${reports ? reports.length : 0} 个关联报告需要删除`);
        
        // 删除关联的报告
        if (reports && reports.length > 0) {
          const reportIds = reports.map(report => report._id);
          for (const reportId of reportIds) {
            try {
              await db.collection('reports').doc(reportId).remove();
              console.log(`成功删除报告: ${reportId}`);
            } catch (err) {
              console.error(`删除报告失败 ${reportId}:`, err);
            }
          }
        }
      } catch (err) {
        console.error('查询或删除报告时出错:', err);
      }
    }
    
    // 等待所有删除操作完成
    const results = await Promise.all(deletePromises);
    const successCount = results.filter(r => r.success).length;
    
    return {
      code: 0,
      message: '批量删除成功',
      data: {
        total: chatIds.length,
        success: successCount,
        failed: chatIds.length - successCount
      }
    }
  } catch (error) {
    console.error('批量删除失败:', error);
    return {
      code: 500,
      message: '批量删除失败: ' + error.message,
      error: error
    }
  }
}