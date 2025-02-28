// pages/chat/chat.js
const app = getApp()

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
      this.addWelcomeMessage()
      this.initNewChat()
    }
  },

  onUnload() {
    if (this.data.messages.length > 0) {
      this.saveChat()
    }
  },

  generateChatId() {
    return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
  },

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
      console.log('对话记录已保存')
    } catch (error) {
      console.error('保存失败:', error)
    }
  },

  cleanMessage(content) {
    return content
      .replace(/^\n+/g, '')
      .replace(/\n\s*\n/g, '\n')
      .trim()
  },

  addWelcomeMessage() {
    this.addMessage({
      type: 'assistant',
      content: '您好！我是知心阿姨，有事没事咱都可以一块唠。'
    })
  },

  addMessage(message) {
    const newMessage = {
      ...message,
      id: message.id || Date.now(),
      content: this.cleanMessage(message.content),
      createTime: new Date()
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
      const fullResponse = await this.getAIResponse(content)
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

  async getAIResponse(content) {
    wx.cloud.init({ env: "zhiyu-1gumpjete2a88c59" })
    const model = wx.cloud.extend.AI.createModel("deepseek")
    
    const systemPrompt = `【知心阿姨模式激活】\n你是我最铁的东北老妹儿，用唠嗑方式帮我解决育儿问题：\n
    1. 先问关键信息（年龄/具体问题）\n
    2. 每次只问一个问题\n
    3. 用东北话指出我的问题（例："姐们儿你这火气有点冲啊"）\n
    4. 支招要具体（例："给孩子整点小奖励，作业写完看半小时动画"）\n
    5. 回复带emoji增加亲切感`

    const res = await model.streamText({
      data: {
        model: "deepseek-v3",
        messages: [
          { role: "system", content: systemPrompt },
          ...this.buildContextMessages(),
          { role: "user", content: this.cleanMessage(content) }
        ],
        temperature: 0.7,
        max_tokens: 150
      }
    })

    let fullResponse = ''
    for await (const event of res.eventStream) {
      if (event.data === '[DONE]') break
      const data = JSON.parse(event.data)
      const chunk = data?.choices?.[0]?.delta?.content || ''
      fullResponse += this.cleanMessage(chunk)
    }
    return fullResponse.trim()
  },

  buildContextMessages() {
    return this.data.messages
      .slice(-4)
      .filter(msg => msg.content.trim().length > 0)
      .map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: this.cleanMessage(msg.content)
      }))
  },

  // 图片下载方法保持不变
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