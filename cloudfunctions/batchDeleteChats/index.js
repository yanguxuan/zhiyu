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
    const deleteResults = [];
    
    // 逐个删除聊天记录
    for (const chatId of chatIds) {
      try {
        // 先检查记录是否存在
        const chat = await db.collection('chatHistory').doc(chatId).get();
        console.log(`找到聊天记录: ${chatId}`, chat);
        
        // 执行删除操作 - 使用正确的集合名称 chatHistory 而不是 chats
        const deleteResult = await db.collection('chatHistory').doc(chatId).remove();
        console.log(`成功删除聊天: ${chatId}`, deleteResult);
        
        if (deleteResult.stats && deleteResult.stats.removed > 0) {
          deleteResults.push({ chatId, success: true });
        } else {
          console.error(`删除聊天失败 ${chatId}: 没有记录被删除`);
          deleteResults.push({ chatId, success: false, error: '没有记录被删除' });
        }
      } catch (err) {
        console.error(`删除聊天失败 ${chatId}:`, err);
        deleteResults.push({ chatId, success: false, error: err });
      }
    }
    
    // 如果需要删除关联的报告
    if (deleteReports) {
      try {
        // 查询关联的报告 - 使用正确的集合名称，可能是 analysisReports
        for (const chatId of chatIds) {
          try {
            const { data: reports } = await db.collection('user_imf')
              .where({
                chatId: chatId
              })
              .get();
            
            console.log(`找到 ${reports ? reports.length : 0} 个关联报告需要删除，chatId: ${chatId}`);
            
            // 删除关联的报告
            if (reports && reports.length > 0) {
              for (const report of reports) {
                try {
                  const deleteReportResult = await db.collection('user_imf').doc(report._id).remove();
                  console.log(`成功删除报告: ${report._id}`, deleteReportResult);
                } catch (err) {
                  console.error(`删除报告失败 ${report._id}:`, err);
                }
              }
            }
          } catch (err) {
            console.error(`查询报告失败，chatId: ${chatId}`, err);
          }
        }
      } catch (err) {
        console.error('查询或删除报告时出错:', err);
      }
    }
    
    // 统计删除结果
    const successCount = deleteResults.filter(r => r.success).length;
    
    return {
      code: 0,
      message: '批量删除成功',
      data: {
        total: chatIds.length,
        success: successCount,
        failed: chatIds.length - successCount,
        results: deleteResults
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