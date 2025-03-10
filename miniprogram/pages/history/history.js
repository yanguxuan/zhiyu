// pages/history/history.js
const app = getApp();

Page({
  data: {
    historyList: [],
    loading: true,
    isBatchDelete: false,
    isAllSelected: false,
    currentUser: null
  },

  onLoad() {
    this.verifyLoginStatus();
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

      const validChats = result.data
        .filter(chat => this.validateChatStructure(chat))
        .map(chat => this.formatChatItem(chat))
        .sort((a, b) => b.createTime - a.createTime);

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

  // 数据结构验证
  validateChatStructure(chat) {
    return chat && chat._id && chat.metadata && chat.messages?.length > 0;
  },

  // 格式化聊天条目
  formatChatItem(chat) {
    const lastMessage = chat.messages[chat.messages.length - 1];
    return {
      _id: chat._id,
      title: this.generateTitle(chat),
      stage: chat.metadata?.lastStage || '未知阶段',
      lastMessage: this.formatLastMessage(lastMessage),
      createTime: this.formatTime(chat.createTime),
      updateTime: this.formatTime(chat.updateTime),
      avatar: lastMessage.type === 'user' 
        ? this.data.currentUser.avatar 
        : '/images/bot_avatar.png',
      selected: false
    };
  },

  // 生成智能标题
  generateTitle(chat) {
    if (chat.metadata?.customTitle) return chat.metadata.customTitle;
    const firstUserMessage = chat.messages.find(m => m.type === 'user');
    return firstUserMessage?.content?.substring(0, 12) || '未命名对话';
  },

  // 格式化最后消息
  formatLastMessage(message) {
    if (!message) return '';
    const content = message.content.replace(/[\n\r]/g, ' ');
    return content.length > 20 ? `${content.substring(0, 20)}...` : content;
  },

  // 时间格式化
  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
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

  // 删除单条对话
  async deleteChat(e) {
    const { chatId } = e.currentTarget.dataset;
    if (!this.validateChatId(chatId)) return;

    try {
      const res = await wx.showModal({
        title: '确认删除',
        content: '将永久删除该对话及其分析报告',
        confirmColor: '#ff4444'
      });

      if (res.confirm) {
        await this.executeDelete(chatId);
        this.updateListAfterDeletion(chatId);
      }
    } catch (error) {
      this.handleDeleteError(error);
    }
  },

  // 执行删除操作
  async executeDelete(chatId) {
    wx.showLoading({ title: '删除中...' });
    await wx.cloud.callFunction({
      name: 'deleteHistoryChat',
      data: { 
        chatId,
        deleteReport: true // 同步删除关联报告
      }
    });
    wx.hideLoading();
  },

  // 更新列表状态
  updateListAfterDeletion(chatId) {
    this.setData({
      historyList: this.data.historyList.filter(item => item._id !== chatId)
    });
    wx.showToast({
      title: '删除成功',
      icon: 'success',
      duration: 1500
    });
  },

  // 处理删除错误
  handleDeleteError(error) {
    console.error('删除失败:', error);
    wx.hideLoading();
    wx.showToast({
      title: error.errMsg || '删除失败',
      icon: 'error'
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
      historyList: updatedList
    });
  },

  // 单选条目
  toggleSelect(e) {
    const { index } = e.currentTarget.dataset;
    const updatedList = [...this.data.historyList];
    updatedList[index].selected = !updatedList[index].selected;

    this.setData({
      historyList: updatedList,
      isAllSelected: updatedList.every(item => item.selected)
    });
  },

  // 全选/取消全选
  selectAll() {
    const newState = !this.data.isAllSelected;
    this.setData({
      historyList: this.data.historyList.map(item => ({
        ...item,
        selected: newState
      })),
      isAllSelected: newState
    });
  },

  // 批量删除
  async deleteSelected() {
    const selectedChats = this.data.historyList.filter(item => item.selected);
    if (selectedChats.length === 0) return;

    try {
      const res = await wx.showModal({
        title: `确认删除 ${selectedChats.length} 个对话?`,
        content: '将同步删除所有关联分析报告',
        confirmColor: '#ff4444'
      });

      if (res.confirm) {
        await this.executeBatchDelete(selectedChats);
        this.updateListAfterBatchDelete(selectedChats);
      }
    } catch (error) {
      this.handleBatchDeleteError(error);
    }
  },

  // 执行批量删除
  async executeBatchDelete(selectedChats) {
    wx.showLoading({ title: `删除${selectedChats.length}项...` });
    await wx.cloud.callFunction({
      name: 'batchDeleteChats',
      data: {
        chatIds: selectedChats.map(c => c._id),
        deleteReports: true
      }
    });
    wx.hideLoading();
  },

  // 更新批量删除后的列表
  updateListAfterBatchDelete(selectedChats) {
    const remainingChats = this.data.historyList.filter(
      item => !selectedChats.some(s => s._id === item._id)
    );
    
    this.setData({
      historyList: remainingChats,
      isBatchDelete: false
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