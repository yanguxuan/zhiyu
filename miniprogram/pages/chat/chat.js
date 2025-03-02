// pages/chat/chat.js
const app = getApp()
const BOT_ID = "bot-5edc583e" // 集中管理智能体ID

Page({
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

  onLoad(options) {
    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }

    this.setData({
      userInfo,
      chatId: options.chatId || this.generateChatId(),
      isHistory: options.isHistory === 'true'
    })

    this.downloadBackgroundImage()
    this.downloadLogoImage()

    if (this.data.isHistory) {
      this.loadHistoryChat(this.data.chatId)
    } else {
      this.initNewChat()
      this.getAgentWelcome() // 初始化智能体信息
    }

    // 确保云环境初始化
    wx.cloud.init({ env: "zhiyu-1gumpjete2a88c59" })
  },

  onUnload() {
    if (this.data.messages.length > 0) {
      this.saveChat()
    }
  },

  // 工具方法
  generateChatId() {
    return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
  },

  cleanMessage(content) {
    return content
      .replace(/^\n+/g, '')
      .replace(/\n\s*\n/g, '\n')
      .trim()
  },

  // 数据存储相关
  async initNewChat() {
    try {
      await wx.cloud.callFunction({
        name: 'saveHistoryChat',
        data: {
          action: 'create',
          chatId: this.data.chatId,
          userInfo: this.data.userInfo,
          messages: []
        }
      })
    } catch (error) {
      console.error('初始化对话失败:', error)
    }
  },

  async loadHistoryChat(chatId) {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'getHistoryChats',
        data: { chatId }
      })

      if (result.code === 0 && result.data) {
        this.setData({
          messages: result.data.messages.map(msg => ({
            ...msg,
            content: this.cleanMessage(msg.content),
            createTime: msg.createTime ? new Date(msg.createTime) : new Date()
          }))
        }, this.scrollToBottom)
      }
    } catch (error) {
      console.error('加载历史对话失败:', error)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  async saveChat() {
    try {
      await wx.cloud.callFunction({
        name: 'saveHistoryChat',
        data: {
          action: 'update',
          chatId: this.data.chatId,
          messages: this.data.messages.map(msg => ({
            ...msg,
            content: this.cleanMessage(msg.content),
            createTime: msg.createTime || new Date()
          }))
        }
      })
    } catch (error) {
      console.error('保存失败:', error)
    }
  },

  // 消息处理
  addMessage(message) {
    const newMessage = {
      ...message,
      id: message.id || Date.now(),
      content: this.cleanMessage(message.content),
      createTime: new Date(),
      isQuestionTip: message.isQuestionTip || false
    }

    this.setData({
      messages: [...this.data.messages, newMessage]
    }, () => {
      this.scrollToBottom()
      this.saveChat()
    })
  },

  scrollToBottom() {
    wx.pageScrollTo({
      scrollTop: 99999,
      duration: 300
    })
  },

  // 智能体交互
  async getAgentWelcome() {
    try {
      // 获取智能体配置
      const { data: agentInfo } = await wx.cloud.extend.AI.bot.get({ 
        botId: BOT_ID 
      })
      
      // 添加欢迎消息
      this.addMessage({
        type: 'assistant',
        content: agentInfo.welcomeMessage || '您好！我是智能助手，随时为您服务。'
      })

      // 获取推荐问题
      try {
        const res = await wx.cloud.extend.AI.bot.getRecommendQuestions({
          data: { botId: BOT_ID }
        })

        for await (let question of res.textStream) {
          this.addMessage({
            type: 'system',
            content: `推荐问题：${question}`,
            isQuestionTip: true
          })
        }
      } catch (err) {
        console.error('推荐问题获取失败:', err)
      }
    } catch (err) {
      console.error('智能体初始化失败:', err)
      this.addMessage({
        type: 'assistant',
        content: '您好！我是知心阿姨，有事没事咱都可以一块唠。'
      })
    }
  },

  // 用户交互
  onInput(e) {
    this.setData({
      inputValue: e.detail.value,
      isDisabled: e.detail.value.trim() === ''
    })
  },

  async sendMessage() {
    const content = this.data.inputValue.trim()
    if (!content || this.data.loading) return

    this.setData({ 
      inputValue: '',
      loading: true,
      isDisabled: true
    })

    this.addMessage({
      type: 'user',
      content,
      userInfo: this.data.userInfo
    })

    try {
      const fullResponse = await this.getBotResponse(content)
      this.addMessage({
        type: 'assistant',
        content: fullResponse
      })
    } catch (err) {
      console.error('发送失败:', err)
      wx.showToast({
        title: err.message || '发送失败',
        icon: 'none',
        duration: 2000
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  async getBotResponse(content) {
    try {
      const res = await wx.cloud.extend.AI.bot.sendMessage({
        data: {
          botId: BOT_ID,
          msg: this.cleanMessage(content)
        }
      })

      let fullResponse = ''
      for await (let event of res.eventStream) {
        if (event.data === '[DONE]') break
        
        try {
          const data = JSON.parse(event.data)
          // 合并思维链和内容
          fullResponse += (data.reasoning_content || '') + (data.content || '')
        } catch (e) {
          console.error('数据解析错误:', e)
        }
      }
      
      return fullResponse.trim()
    } catch (err) {
      console.error('智能体调用失败:', err)
      throw new Error('服务暂时不可用，请稍后再试')
    }
  },

  // 图片处理
  downloadBackgroundImage() {
    wx.cloud.downloadFile({
      fileID: 'cloud://zhiyu-1gumpjete2a88c59.7a68-zhiyu-1gumpjete2a88c59-1339882768/images/background.png',
      success: res => this.setData({ backgroundImagePath: res.tempFilePath }),
      fail: err => console.error('背景图下载失败:', err)
    })
  },

  downloadLogoImage() {
    wx.cloud.downloadFile({
      fileID: 'cloud://zhiyu-1gumpjete2a88c59.7a68-zhiyu-1gumpjete2a88c59-1339882768/images/logo.png',
      success: res => this.setData({ logoPath: res.tempFilePath }),
      fail: err => console.error('LOGO下载失败:', err)
    })
  }
})