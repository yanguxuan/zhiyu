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

    if (options.chatId && this.data.isHistory) {
      this.loadHistoryChat(options.chatId)
    } else {
      this.addWelcomeMessage()
    }
  },

  onUnload() {
    if (this.data.messages.length > 1) {
      this.saveChat()
    }
  },

  generateChatId() {
    return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },

  async loadHistoryChat(chatId) {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'getHistoryChats',
        data: { chatId }
      })

      if (result.code === 0 && result.data?.[0]?.messages) {
        this.setData({
          messages: result.data[0].messages.map(msg => ({
            ...msg,
            id: msg.id || Date.now(),
            // 清理消息空白
            content: msg.content.replace(/^\n+/, '')
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
          chatId: this.data.chatId,
          messages: this.data.messages.map(msg => ({
            ...msg,
            // 确保保存时清理空白
            content: msg.content.replace(/^\n+/, '')
          }))
        }
      })
      console.log('对话记录已更新')
    } catch (error) {
      console.error('保存失败:', error)
    }
  },

  addWelcomeMessage() {
    this.addMessage({
      type: 'assistant',
      content: '您好！我是知心阿姨，有事没事咱都可以一块唠。',
      id: Date.now()
    })
  },

  addMessage(message) {
    const cleanedMessage = {
      ...message,
      content: message.content.replace(/^\n+/, '') // 去除开头换行
    }
    
    this.setData({
      messages: [...this.data.messages, {
        ...cleanedMessage,
        id: cleanedMessage.id || Date.now()
      }]
    }, this.scrollToBottom)
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

    // 添加用户消息
    this.addMessage({
      type: 'user',
      content,
      userInfo: this.data.userInfo
    })

    try {
      // 大模型流式调用
      const fullResponse = await this.getAIResponse(content)
      
      // 添加助手回复
      this.addMessage({
        type: 'assistant',
        content: fullResponse
      })

      // 立即保存更新
      await this.saveChat()

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
    
    const systemPrompt = `你是一位知心阿姨，带有赵本山式的唠嗑风格
    我是一个6 - 18岁的孩子的家长,你是我的好朋友
    我的孩子每天会经历各种事情和情绪活动,我遇到事情会找你寻求帮助。
    而你会根据以下的情绪教导理论进行帮助：
    1.可以通过多轮对话询问来获取信息，如：(1)孩子的年龄(2)我关于孩子的困扰等，来使建议更加有效
    2.亲子之间有沟通问题，也可能是家长的态度，语气等有问题。可以引导我对自己行为反思
    3.提供具体的、有帮助的、对我无害的建议使我的问题得以解决。
    要求:
        1.你的每个回复都不会超过70字
        2.可以通过询问孩子的习惯，是否经历过某些事来推断孩子出现异常行为的原因
        3.你的回答要言简意赅，自然流畅，语重心长，富有温度
        4.每次最多问一个问题
        5.可以委婉，有道理的指出家长一些做法的不当之处，并给出可能的补救措施
        6.灵活参照数据库中的示例`

    const res = await model.streamText({
      data: {
        model: "deepseek-v3", // 改用V3模型
        messages: [
          { role: "system", content: systemPrompt },
          ...this.buildContextMessages(),
          { role: "user", content }
        ]
      }
    })

    let fullResponse = ''
    for await (const event of res.eventStream) {
      if (event.data === '[DONE]') break
      const data = JSON.parse(event.data)
      const chunk = data?.choices?.[0]?.delta?.content || ''
      
      // 实时清理空白字符
      fullResponse += chunk.replace(/^\n+/, '')
    }
    return fullResponse.trim()
  },

  buildContextMessages() {
    return this.data.messages
      .slice(-4)
      .filter(msg => msg.content) // 过滤空内容
      .map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content.replace(/^\n+/, '')
      }))
  },

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