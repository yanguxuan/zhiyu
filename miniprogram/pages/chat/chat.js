// pages/chat/chat.js
const app = getApp();
const AGENT_CONFIG = {
  COLLECT: { id: "bot-5edc583e", threshold: 5, name: "信息收集" },
  ANALYZE: { id: "bot-503ca8ed", threshold: 3, name: "分析诊断" },
  ADVISE: { id: "bot-81d29121", name: "建议生成" },
  SUMMARY: { id: "bot-8995acfa", timeout: 600000, name: "总结报告" }
};

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
    isDisabled: true,
    currentStage: AGENT_CONFIG.COLLECT,
    stageProgress: 0,
    lastActive: Date.now()
  },

  onLoad(options) {
    wx.cloud.init({ 
      env: "zhiyu-1gumpjete2a88c59",
      traceUser: true
    });

    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }

    this.setData({
      userInfo,
      chatId: options.chatId || this.generateChatId(),
      isHistory: options.isHistory === 'true'
    });

    this.downloadBackgroundImage();
    this.downloadLogoImage();

    if (this.data.isHistory) {
      this.loadHistoryChat(this.data.chatId);
    } else {
      this.initNewChat();
      this.getAgentWelcome();
    }
  },

  onUnload() {
    if (this.data.messages.length > 0) {
      this.saveChat();
    }
    clearTimeout(this.summaryTimer);
  },

  generateChatId() {
    return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  },

  cleanMessage(content) {
    return content
      .replace(/^\n+/g, '')
      .replace(/\n\s*\n/g, '\n')
      .trim();
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
      });
    } catch (error) {
      console.error('初始化对话失败:', error);
    }
  },

  async loadHistoryChat(chatId) {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'getHistoryChats',
        data: { chatId }
      });

      if (result.code === 0 && result.data) {
        this.setData({
          messages: result.data.messages.map(msg => ({
            ...msg,
            content: this.cleanMessage(msg.content),
            createTime: msg.createTime ? new Date(msg.createTime) : new Date(),
            metadata: msg.metadata || {}
          }))
        }, this.scrollToBottom);
      }
    } catch (error) {
      console.error('加载历史对话失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async saveChat() {
    let retries = 3;
    while (retries > 0) {
      try {
        await wx.cloud.callFunction({
          name: 'saveHistoryChat',
          data: {
            action: 'update',
            chatId: this.data.chatId,
            messages: this.data.messages.map(msg => ({
              ...msg,
              content: this.cleanMessage(msg.content),
              createTime: msg.createTime || new Date(),
              metadata: {
                ...msg.metadata,
                botId: this.data.currentStage.id,
                stage: this.data.currentStage.name
              }
            }))
          }
        });
        return;
      } catch (error) {
        console.error(`保存失败，剩余重试次数${retries}`, error);
        retries--;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  },

  addMessage(message) {
    const newMessage = {
      ...message,
      id: message.id || Date.now(),
      content: this.cleanMessage(message.content),
      createTime: new Date(),
      isQuestionTip: message.isQuestionTip || false,
      selectable: true,
      metadata: {
        botId: this.data.currentStage.id,
        stage: this.data.currentStage.name,
        timestamp: Date.now()
      }
    };

    this.setData({
      messages: [...this.data.messages, newMessage]
    }, () => {
      this.scrollToBottom();
      this.saveChat();
    });
  },

  scrollToBottom() {
    wx.pageScrollTo({
      scrollTop: 99999,
      duration: 300
    });
  },

  async getAgentWelcome() {
    try {
      const res = await wx.cloud.extend.AI.bot.get({ 
        botId: this.data.currentStage.id 
      });
      
      const agentInfo = res.data || {};
      this.addMessage({
        type: 'assistant',
        content: agentInfo.welcomeMessage || '您好！我是育儿助手DeepCare~',
        selectable: true
      });
    } catch (err) {
      console.error('智能体初始化失败:', err);
      this.addMessage({
        type: 'assistant',
        content: '大妹子，有啥育儿难题尽管跟老姐唠！',
        selectable: true
      });
    }
  },

  onInput: function(e) {
    this.setData({
      inputValue: e.detail.value,
      isDisabled: e.detail.value.trim() === ''
    });
  },

  async sendMessage() {
    const content = this.data.inputValue.trim();
    if (!content || this.data.loading) return;

    this.setData({ 
      inputValue: '',
      loading: true,
      lastActive: Date.now(),
      isDisabled: true
    });

    this.addMessage({ type: 'user', content, selectable: true });

    try {
      const response = await this.processStage(content);
      this.addMessage({ type: 'assistant', content: response, selectable: true });

      if (this.shouldTransitionStage()) {
        await this.transitionAgent();
      }
    } catch (err) {
      console.error('发送失败:', err);
      wx.showToast({ title: err.message || '发送失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
      this.scheduleSummaryCheck();
    }
  },

  async processStage(content) {
    const history = this.getContextHistory();
    this.setData({ stageProgress: this.data.stageProgress + 1 });
    return this.getBotResponse(content, history);
  },

  getContextHistory() {
    return this.data.messages
      .filter(msg => !msg.isSystem)
      .map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));
  },

  shouldTransitionStage() {
    return this.data.currentStage.threshold && 
      this.data.stageProgress >= this.data.currentStage.threshold;
  },

  async transitionAgent() {
    const stageOrder = [AGENT_CONFIG.COLLECT, AGENT_CONFIG.ANALYZE, AGENT_CONFIG.ADVISE];
    const currentIndex = stageOrder.findIndex(s => s.id === this.data.currentStage.id);
    
    if (currentIndex < stageOrder.length - 1) {
      await this.saveChat();
      await this.loadHistoryChat(this.data.chatId);
      
      const nextStage = stageOrder[currentIndex + 1];
      this.setData({
        currentStage: nextStage,
        stageProgress: 0
      });

      await this.addTransitionMessage(nextStage);
      this.addMessage({
        type: 'system',
        content: `当前阶段：${nextStage.name}，已加载${this.data.messages.length}条上下文`,
        selectable: true
      });
    }
  },

  async addTransitionMessage(stage) {
    const messages = {
      [AGENT_CONFIG.ANALYZE.id]: "🔍咱这情况摸得差不离了，现在掰扯掰扯里头的道道...",
      [AGENT_CONFIG.ADVISE.id]: "💡整明白了症结，合计合计咋下这剂猛药..."
    };

    if (messages[stage.id]) {
      this.addMessage({
        type: 'system',
        content: messages[stage.id],
        isSystem: true,
        selectable: true
      });
    }
  },

  scheduleSummaryCheck() {
    clearTimeout(this.summaryTimer);
    this.summaryTimer = setTimeout(async () => {
      if (Date.now() - this.data.lastActive > AGENT_CONFIG.SUMMARY.timeout) {
        await this.generateSummary();
      }
    }, AGENT_CONFIG.SUMMARY.timeout);
  },

  async generateSummary() {
    try {
      const summary = await this.getBotResponse(
        "生成总结报告", 
        [], 
        AGENT_CONFIG.SUMMARY.id
      );
      
      await this.saveSummaryToCloud(summary);
      this.addMessage({
        type: 'assistant',
        content: `📊总结报告已生成！\n${summary}`,
        selectable: true
      });
    } catch (err) {
      console.error('总结生成失败:', err);
    }
  },

  async saveSummaryToCloud(summary) {
    try {
      await wx.cloud.callFunction({
        name: 'saveUserInfo',
        data: {
          collection: 'user_imf',
          data: {
            userId: this.data.userInfo._id,
            chatId: this.data.chatId,
            summary: this.parseSummaryTable(summary),
            timestamp: wx.cloud.database().serverDate()
          }
        }
      });
    } catch (err) {
      console.error('云存储失败:', err);
    }
  },

  parseSummaryTable(summary) {
    return summary.split('\n')
      .slice(2)
      .filter(line => line.includes('|'))
      .map(line => {
        const cells = line.split('|').slice(1, -1);
        return {
          explicit: cells[0].trim(),
          implicit: cells[1].trim()
        };
      });
  },

  async getBotResponse(content, history = [], specificBotId) {
    try {
      const botId = specificBotId || this.data.currentStage.id;
      const res = await wx.cloud.extend.AI.bot.sendMessage({
        data: {
          botId,
          msg: this.cleanMessage(content),
          history: botId === AGENT_CONFIG.SUMMARY.id ? 
            this.getSummaryContext() : 
            history
        }
      });

      let fullResponse = '';
      for await (const event of res.eventStream) {
        if (event.data === '[DONE]') break;
        
        try {
          const data = JSON.parse(event.data);
          fullResponse += data.content || '';
          
          if (app.globalData.debugMode && data.reasoning_content) {
            console.debug('[REASONING]', data.reasoning_content);
          }
        } catch (e) {
          console.error('数据解析错误:', e);
        }
      }
      
      return fullResponse.trim();
    } catch (err) {
      console.error('智能体调用失败:', err);
      return '服务暂时不可用，请稍后再试';
    }
  },

  getSummaryContext() {
    return this.data.messages
      .filter(msg => msg.selectable)
      .map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));
  },

  downloadBackgroundImage() {
    wx.cloud.downloadFile({
      fileID: 'cloud://zhiyu-1gumpjete2a88c59.7a68-zhiyu-1gumpjete2a88c59-1339882768/images/background.png',
      success: res => {
        this.setData({ backgroundImagePath: res.tempFilePath });
      },
      fail: err => console.error('背景图下载失败:', err)
    });
  },

  downloadLogoImage() {
    wx.cloud.downloadFile({
      fileID: 'cloud://zhiyu-1gumpjete2a88c59.7a68-zhiyu-1gumpjete2a88c59-1339882768/images/dolphin_logo.png',
      success: res => {
        this.setData({ logoPath: res.tempFilePath });
      },
      fail: err => console.error('LOGO下载失败:', err)
    });
  }
});