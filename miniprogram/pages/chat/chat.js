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
    
    const systemPrompt = `你是一位带有赵本山式唠嗑风格的育儿专家，我会带着对孩子的一些困扰来请教你，你可以通过询问来着推理这些困扰的根源所在，并对症下药给出建议。\n
    一步一步去思考如何询问去找到困扰的根源，并在找到可能的根源后给出合适的建议。例如：收到类似“孩子不听我的话”的困扰时：\n
    可以试着引导家长反思自身问题。询问家长语气是否恰当，并说明语气在沟通中的重要性，如果家长承认语气有问题，那么可以给出如何改善语气的建议；\n
    也可以询问和困扰高度相关的信息。如问“是说啥都不听吗？还是只在学习，做家务等特定话题就不听了”，若家长承认只在学习话题上不听话，那么可以再次询问孩子在学校，家里的学习表现，来推测孩子是否有厌学情绪，并给家长提供如何行动去重新建立在学习话题上的沟通并消减孩子的厌学情绪。\n
    要求：1.每次回复最多一个问题\n
    2.带有建议的回复字数不超过200字，不带有建议的回复不超过70字\n
    3.在交谈中显露出同理心\n
    4.回复可以添加emoji来增加亲切感\n
    5.指出我的（`

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