// pages/chat/chat.js
const app = getApp()

Page({

  /**
   * 页面的初始数据
   */
  data: {
    messages: [],
    inputValue: '',
    loading: false,
    userInfo: null,
    backgroundImagePath: '', 
    logoPath: '', 
    chatId: null,
    isHistory: false,
    isDisabled: true 
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo) {
      wx.reLaunch({
        url: '/pages/login/login'
      })
      return
    }

    this.setData({
      userInfo,
      chatId: options.chatId || null,
      isHistory: options.isHistory === 'true'
    })

    // 下载背景图片
    this.downloadBackgroundImage()

    // 下载 logo 图片
    this.downloadLogoImage()

    // 如果是历史对话
    if (options.chatId && options.isHistory === 'true') {
      this.loadHistoryChat(options.chatId)
    } else {
      // 添加欢迎消息
      this.addMessage({
        type: 'assistant',
        content: '您好！我是知心阿姨，有事没事咱都可以一块唠。'
      })
    }
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    // 页面卸载时保存对话
    if (this.data.messages.length > 1) { 
      this.saveChat()
    }
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },

  // 加载历史对话
  async loadHistoryChat(chatId) {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'getHistoryChats',
        data: { chatId }
      })

      if (result.code === 0 && result.data && result.data.length > 0) {
        const chat = result.data[0]
        if (!chat.messages) {
          throw new Error('对话数据格式错误')
        }

        this.setData({
          messages: chat.messages.map(msg => ({
            ...msg,
            id: Date.now() + Math.random()
          }))
        }, () => {
          // 滚动到最新消息
          wx.pageScrollTo({
            scrollTop: 9999,
            duration: 100
          })
        })
      } else {
        throw new Error(result.message || '加载对话失败')
      }
    } catch (error) {
      console.error('加载历史对话失败：', error)
      wx.showToast({
        title: '加载历史对话失败',
        icon: 'none'
      })
    }
  },

  // 保存对话
  async saveChat() {
    try {
      await wx.cloud.callFunction({
        name: 'saveHistoryChat',
        data: {
          messages: this.data.messages,
          chatId: this.data.chatId
        }
      })
    } catch (error) {
      console.error('保存对话失败：', error)
    }
  },

  // 添加消息到列表
  addMessage(message) {
    const messages = [...this.data.messages, {
      ...message,
      id: Date.now()
    }]
    this.setData({ messages }, () => {
      // 滚动到最新消息
      wx.pageScrollTo({
        scrollTop: 9999,
        duration: 100
      })
    })
  },

  // 处理输入变化
  onInput(e) {
    const inputValue = e.detail.value
    this.setData({
      inputValue,
      isDisabled: inputValue.trim() === '' 
    })
  },

  // 发送消息
  async sendMessage() {
    const content = this.data.inputValue.trim()
    if (!content || this.data.loading) return

    // 清空输入框并设置加载状态
    this.setData({
      inputValue: '',
      loading: true,
      isDisabled: true
    })

    // 添加用户消息
    this.addMessage({
      type: 'user',
      content,
      userInfo: this.data.userInfo 
    })

    try {
      // 调用云函数获取回复
      const { result } = await wx.cloud.callFunction({
        name: 'chat', // 调用新的云函数
        data: {
          message: content,
          chatId: this.data.chatId
        }
      })

      console.log('云函数返回结果：', result)

      if (result.code === 0) {
        // 添加助手回复
        this.addMessage({
          type: 'assistant',
          content: result.data.response
        })
      } else {
        throw new Error(result.error || '获取回复失败')
      }
    } catch (err) {
      console.error('发送消息失败：', err)
      wx.showToast({
        title: err.message || '发送失败，请重试',
        icon: 'none',
        duration: 2000
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  downloadBackgroundImage: function() {
    const fileID = 'cloud://zhiyu-1gumpjete2a88c59.7a68-zhiyu-1gumpjete2a88c59-1339882768/images/background.png'; 

    wx.cloud.downloadFile({
      fileID: fileID,
      success: res => {
        console.log('下载成功，临时文件路径:', res.tempFilePath);
        this.setData({
          backgroundImagePath: res.tempFilePath 
        });
      },
      fail: err => {
        console.error('下载失败:', err);
      }
    });
  },

  downloadLogoImage: function() {
    const fileID = 'cloud://zhiyu-1gumpjete2a88c59.7a68-zhiyu-1gumpjete2a88c59-1339882768/images/logo.png'; 

    wx.cloud.downloadFile({
      fileID: fileID,
      success: res => {
        console.log('下载成功，临时文件路径:', res.tempFilePath);
        this.setData({
          logoPath: res.tempFilePath 
        });
      },
      fail: err => {
        console.error('下载失败:', err);
      }
    });
  }
})