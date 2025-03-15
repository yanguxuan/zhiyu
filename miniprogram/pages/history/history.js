// pages/history/history.js
const app = getApp();

Page({
  data: {
    historyList: [],
    loading: true,
    isBatchDelete: false,
    isAllSelected: false,
    currentUser: null,
    selectedCount: 0  // 添加选中计数
  },

  // 修复formatTime函数在WXML中的调用问题
  onLoad() {
    this.verifyLoginStatus();
    // 将formatTime函数绑定到页面实例，使其可在WXML中调用
    this.formatTime = this.formatTime.bind(this);
  },

  onShow() {
    this.getHistoryList();
  },

  // 验证登录状态
  async verifyLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.setData({ currentUser: userInfo });
  },

  // 获取增强版历史记录
  async getHistoryList() {
    wx.showLoading({ title: '加载中...' });
    
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'getHistoryChats',
        data: { detail: true } // 请求详细数据
      });
  
      if (!result || !result.data || !Array.isArray(result.data)) {
        throw new Error('返回数据格式错误');
      }
  
      const validChats = result.data
        .filter(chat => chat && chat._id && chat.messages?.length > 0)
        .map(chat => ({
          _id: chat._id,
          title: chat.title || this.extractTitleFromMessages(chat.messages),
          stage: this.extractStageFromMessages(chat.messages),
          lastMessage: this.formatLastMessage(chat.messages[chat.messages.length - 1]),
          // 只保留 updateTime，但仍然使用 createTime 作为备用
          updateTime: chat.updateTime || chat.createTime || '未知时间',
          avatar: this.data.currentUser?.avatar || '/images/default_avatar.png',
          selected: false
        }))
        // 保持排序逻辑不变
        .sort((a, b) => {
          const aTime = a.updateTime || '';
          const bTime = b.updateTime || '';
          return aTime > bTime ? -1 : 1;
        });
  
      this.setData({
        historyList: validChats,
        loading: false
      });
    } catch (error) {
      console.error('获取历史对话失败：', error);
      this.handleDataError();
    } finally {
      wx.hideLoading();
    }
  },

  // 从消息中提取标题
  extractTitleFromMessages(messages) {
    if (!messages || !messages.length) return '未命名对话';
    const firstUserMessage = messages.find(m => m.type === 'user');
    return firstUserMessage?.content?.substring(0, 12) || '未命名对话';
  },

  // 从消息中提取阶段
  extractStageFromMessages(messages) {
    if (!messages || !messages.length) return '未知阶段';
    // 尝试从最后一条消息的metadata中获取阶段信息
    const lastMessage = messages[messages.length - 1];
    return lastMessage?.metadata?.stage || '未知阶段';
  },

  // 格式化最后消息
  formatLastMessage(message) {
    if (!message || !message.content) return '';
    const content = message.content.replace(/[\n\r]/g, ' ');
    return content.length > 20 ? `${content.substring(0, 20)}...` : content;
  },

  // 时间格式化
  formatTime(timestamp) {
    if (!timestamp) return '未知时间';
    
    try {
      // 确保timestamp是Date对象
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      if (isNaN(date.getTime())) return '未知时间'; // 处理无效日期
      
      // 格式化为 月/日 时:分 的形式
      return `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    } catch (error) {
      console.error('时间格式化错误:', error, timestamp);
      return '未知时间';
    }
  },

  // 处理数据错误
  handleDataError() {
    wx.showToast({
      title: '数据加载失败',
      icon: 'error',
      duration: 2000
    });
    this.setData({
      loading: false,
      historyList: []
    });
  },

  // 继续对话
  continueChat(e) {
    const { chatId } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/chat/chat?chatId=${chatId}&isHistory=true`
    });
  },

  // 新建对话
  startNewChat() {
    wx.navigateTo({
      url: '/pages/chat/chat'
    });
  },

  // 切换批量删除模式
  toggleBatchDelete() {
    const updatedList = this.data.historyList.map(item => ({
      ...item,
      selected: this.data.isBatchDelete ? false : item.selected
    }));
    
    this.setData({
      isBatchDelete: !this.data.isBatchDelete,
      isAllSelected: false,
      historyList: updatedList,
      selectedCount: 0  // 重置选中计数
    });
  },

  // 单选条目
  toggleSelect(e) {
    const { index } = e.currentTarget.dataset;
    const updatedList = [...this.data.historyList];
    updatedList[index].selected = !updatedList[index].selected;
    
    // 计算选中数量
    const selectedCount = updatedList.filter(item => item.selected).length;
    
    this.setData({
      historyList: updatedList,
      isAllSelected: updatedList.every(item => item.selected),
      selectedCount: selectedCount
    });
  },

  // 全选/取消全选
  selectAll() {
    const newState = !this.data.isAllSelected;
    const updatedList = this.data.historyList.map(item => ({
      ...item,
      selected: newState
    }));
    
    this.setData({
      historyList: updatedList,
      isAllSelected: newState,
      selectedCount: newState ? updatedList.length : 0
    });
  },

  // 批量删除
  async deleteSelected() {
    const selectedChats = this.data.historyList.filter(item => item.selected);
    if (selectedChats.length === 0) {
      wx.showToast({
        title: '请先选择要删除的对话',
        icon: 'none'
      });
      return;
    }

    try {
      const res = await wx.showModal({
        title: `确认删除 ${selectedChats.length} 个对话?`,
        content: '将同步删除所有关联分析报告',
        confirmColor: '#ff4444'
      });

      if (res.confirm) {
        const success = await this.executeBatchDelete(selectedChats);
        if (success) {
          this.updateListAfterBatchDelete(selectedChats);
        } else {
          this.handleBatchDeleteError(new Error('批量删除失败'));
        }
      }
    } catch (error) {
      this.handleBatchDeleteError(error);
    }
  },

  // 执行批量删除
  async executeBatchDelete(selectedChats) {
    if (!Array.isArray(selectedChats) || selectedChats.length === 0) return false;
    
    wx.showLoading({ title: `删除${selectedChats.length}项...` });
    try {
      console.log('准备调用批量删除云函数，参数:', {
        chatIds: selectedChats.map(chat => chat._id),
        deleteReports: true
      });
      
      const { result } = await wx.cloud.callFunction({
        name: 'batchDeleteChats',
        data: {
          chatIds: selectedChats.map(chat => chat._id),
          deleteReports: true
        }
      });
      
      console.log('批量删除云函数返回结果:', result);
      
      wx.hideLoading();
      if (result && result.code === 0) {
        return true;
      }
      
      // 显示更详细的错误信息
      const errorMsg = result?.message || '批量删除失败';
      console.error('批量删除失败，服务器返回:', errorMsg);
      wx.showToast({
        title: errorMsg,
        icon: 'none',
        duration: 2000
      });
      return false;
    } catch (error) {
      console.error('批量删除请求失败:', error);
      wx.hideLoading();
      
      // 显示更具体的错误信息
      wx.showToast({
        title: error.message || '批量删除请求失败',
        icon: 'none',
        duration: 2000
      });
      return false;
    }
  },

  // 更新批量删除后的列表
  updateListAfterBatchDelete(selectedChats) {
    if (!Array.isArray(selectedChats) || selectedChats.length === 0) return;
    
    const selectedIds = selectedChats.map(chat => chat._id);
    const remainingChats = this.data.historyList.filter(
      item => !selectedIds.includes(item._id)
    );
    
    this.setData({
      historyList: remainingChats,
      isBatchDelete: false,
      isAllSelected: false,
      selectedCount: 0
    });
    
    wx.showToast({
      title: `已删除${selectedChats.length}项`,
      icon: 'success'
    });
  },

  // 处理批量删除错误
  handleBatchDeleteError(error) {
    console.error('批量删除失败:', error);
    wx.hideLoading();
    wx.showToast({
      title: '部分删除失败，请重试',
      icon: 'error'
    });
  },

  // 校验chatId格式
  validateChatId(chatId) {
    if (!/^chat_\d{13}_[a-z0-9]{6}$/.test(chatId)) {
      wx.showToast({
        title: '无效对话ID',
        icon: 'error'
      });
      return false;
    }
    return true;
  }
});