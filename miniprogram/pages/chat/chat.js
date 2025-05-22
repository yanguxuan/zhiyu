// pages/chat/chat.js
const app = getApp();
const AGENT_CONFIG = {
  COLLECT: { id: "bot-5edc583e", threshold: 7, name: "信息收集" }, // 修改阈值为7轮
  ADVISE: { id: "bot-81d29121", name: "建议生成" }, // 直接从收集转到建议
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
    stageProgress: 0, // 对话轮次计数
    isFirstUserMessage: true, // 添加标记第一次用户消息的字段
    userAnalysis: null, // 添加用户分析数据字段
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
    
    // 加载用户分析数据
    this.loadUserAnalysis();

    if (this.data.isHistory) {
      this.loadHistoryChat(this.data.chatId);
    } else {
      this.initNewChat();
      this.getAgentWelcome();
    }
  },

  onUnload() {
    if (this.data.messages.length > 0) {
      if (this.data.messages.length === 1) {
        // 如果只有一条消息，删除这个聊天记录
        this.deleteChat();
      } else {
        // 有多条消息，正常保存
        this.saveChat();
      }
    }
  },

  // 添加onHide生命周期函数，确保用户切换页面时也保存聊天记录
  onHide() {
    if (this.data.messages.length > 0 && !this.data.isHistory) {
      if (this.data.messages.length === 1) {
        // 如果只有一条消息，删除这个聊天记录
        this.deleteChat();
      } else {
        // 有多条消息，正常保存
        this.saveChat();
      }
    }
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
        const firstUserMsg = this.data.messages.find(msg => msg.type === 'user');
        const title = firstUserMsg ? 
          (firstUserMsg.content.length > 20 ? 
            firstUserMsg.content.substring(0, 20) + '...' : 
            firstUserMsg.content) : 
          '新对话';
        
        const lastMsg = this.data.messages[this.data.messages.length - 1];
        const lastMessage = lastMsg ? 
          (lastMsg.content.length > 30 ? 
            lastMsg.content.substring(0, 30) + '...' : 
            lastMsg.content) : 
          '';

        await wx.cloud.callFunction({
          name: 'saveHistoryChat',
          data: {
            action: 'update',
            chatId: this.data.chatId,
            title: title,
            lastMessage: lastMessage,
            updateTime: new Date(),
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
      chatId: this.data.chatId, // 添加chatId字段
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
      
      // 不增加stageProgress，开场白不计入轮次
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
      isDisabled: true
    });

    this.addMessage({ type: 'user', content, selectable: true });

    try {
      if (this.data.isFirstUserMessage) {
        this.setData({ 
          isFirstUserMessage: false,
          stageProgress: 1
        });
      } else {
        this.setData({ stageProgress: this.data.stageProgress + 1 });
      }

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
    }
  },

  async processStage(content) {
    const history = this.getContextHistory();
    return this.getBotResponse(content, history);
  },

  getContextHistory() {
    return this.data.messages
      .filter(msg => !msg.isSystem && msg.chatId === this.data.chatId)
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
    const nextStage = AGENT_CONFIG.ADVISE;
    
    await this.saveChat();
    await this.loadHistoryChat(this.data.chatId);
    
    this.setData({
      currentStage: nextStage,
      stageProgress: 0
    });
  },

  async addTransitionMessage(stage) {
    return;
  },

  async getBotResponse(content, history = [], specificBotId) {
    try {
      const botId = specificBotId || this.data.currentStage.id;
      
      // 准备用户画像数据
      let userProfile = '';
      if (this.data.userAnalysis) {
        const analysis = this.data.userAnalysis;
        userProfile = this.generateUserProfile(analysis);
      }

      // 在对话历史的开始添加用户画像信息
      const enhancedHistory = userProfile ? 
        [{ role: 'system', content: userProfile }, ...history] : 
        history;

      const res = await wx.cloud.extend.AI.bot.sendMessage({
        data: {
          botId,
          msg: this.cleanMessage(content),
          history: enhancedHistory
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
      
      // 更新用户画像
      await this.updateUserProfile(content, fullResponse);
      
      return fullResponse.trim();
    } catch (err) {
      console.error('智能体调用失败:', err);
      return '服务暂时不可用，请稍后再试';
    }
  },

  // 生成用户画像信息
  generateUserProfile: function(analysis) {
    try {
      const emotional = this.extractEmotionalTendency(analysis);
      const interests = this.extractMainInterests(analysis);
      const interaction = this.extractInteractionStyle(analysis);
      const demands = this.extractCoreDemands(analysis);
      const strategies = this.extractStrategies(analysis);

      return `
用户画像信息：
1. 情感倾向：${emotional}
2. 主要兴趣：${interests}
3. 交互特点：${interaction}
4. 核心诉求：${demands}
5. 建议策略：${strategies}

对话指导：
1. 根据用户的情感状态调整回应语气
2. 优先关注用户的主要兴趣领域
3. 适应用户的交互习惯
4. 针对核心诉求提供解决方案
5. 参考已有的建议策略
6. 保持对话的连贯性和个性化
7. 适时引导用户深入讨论重要话题
8. 注意观察用户情绪变化并调整回应方式`;
    } catch (err) {
      console.error('生成用户画像失败:', err);
      return '';
    }
  },

  // 更新用户画像
  updateUserProfile: function(userMessage, botResponse) {
    try {
      // 获取当前用户画像
      const currentProfile = this.data.userAnalysis;
      if (!currentProfile) return;

      // 准备更新数据
      const updateData = {
        lastInteraction: new Date(),
        messageCount: (currentProfile.messageCount || 0) + 1,
        lastMessage: userMessage,
        lastResponse: botResponse
      };

      // 更新本地数据
      const updatedProfile = {
        ...currentProfile,
        ...updateData
      };
      this.setData({ userAnalysis: updatedProfile });

      // 保存到本地存储
      wx.setStorageSync('userSummaryReport', updatedProfile);

      // 每10条消息更新一次数据库
      if (updateData.messageCount % 10 === 0) {
        this.saveUserProfileToDB(updatedProfile);
      }
    } catch (err) {
      console.error('更新用户画像失败:', err);
    }
  },

  // 保存用户画像到数据库
  saveUserProfileToDB: function(profile) {
    const db = wx.cloud.database();
    db.collection('user_imf').where({
      userId: this.data.userInfo.openid
    }).get().then(result => {
      if (result.data && result.data.length > 0) {
        // 更新现有记录
        return db.collection('user_imf').doc(result.data[0]._id).update({
          data: {
            ...profile,
            updateTime: new Date()
          }
        });
      } else {
        // 创建新记录
        return db.collection('user_imf').add({
          data: {
            ...profile,
            userId: this.data.userInfo.openid,
            createTime: new Date(),
            updateTime: new Date()
          }
        });
      }
    }).catch(err => {
      console.error('保存用户画像到数据库失败:', err);
    });
  },

  // 辅助函数：提取情感倾向
  extractEmotionalTendency(analysis) {
    try {
      const emotional = analysis.parsedContent.emotionalAnalysis;
      return `情绪状态: ${emotional.emotionalState.join(', ')}, 
              波动规律: ${emotional.emotionalPattern.join(', ')}, 
              压力源: ${emotional.stressors.join(', ')}`;
    } catch (err) {
      return '暂无情感倾向数据';
    }
  },

  // 辅助函数：提取主要兴趣
  extractMainInterests(analysis) {
    try {
      const interests = analysis.parsedContent.interestAnalysis;
      return `关注领域: ${interests.mainInterests.join(', ')}, 
              重点话题: ${interests.repeatedTopics.join(', ')}`;
    } catch (err) {
      return '暂无兴趣数据';
    }
  },

  // 辅助函数：提取交互特点
  extractInteractionStyle(analysis) {
    try {
      const interaction = analysis.parsedContent.interactionAnalysis;
      return `对话频率: ${interaction.frequency.join(', ')}, 
              回应积极度: ${interaction.responsiveness.join(', ')}, 
              问题偏好: ${interaction.questionPreference.join(', ')}`;
    } catch (err) {
      return '暂无交互特点数据';
    }
  },

  // 辅助函数：提取核心诉求
  extractCoreDemands(analysis) {
    try {
      return analysis.parsedContent.diagnosis || '暂无核心诉求数据';
    } catch (err) {
      return '暂无核心诉求数据';
    }
  },

  // 辅助函数：提取建议策略
  extractStrategies(analysis) {
    try {
      return analysis.parsedContent.strategy || '暂无建议策略数据';
    } catch (err) {
      return '暂无建议策略数据';
    }
  },

  downloadBackgroundImage() {
    // 检查WXML中是否实际使用了这个图片，如果没有使用可以移除此函数
    wx.cloud.downloadFile({
      fileID: 'cloud://zhiyu-1gumpjete2a88c59.7a68-zhiyu-1gumpjete2a88c59-1339882768/images/background.png',
      success: res => {
        this.setData({ backgroundImagePath: res.tempFilePath });
      },
      fail: err => {
        console.error('背景图下载失败:', err);
        // 设置默认背景或空值
        this.setData({ backgroundImagePath: '' });
      }
    });
  },

  downloadLogoImage() {
    // 检查WXML中是否实际使用了这个图片，如果没有使用可以移除此函数
    wx.cloud.downloadFile({
      fileID: 'cloud://zhiyu-1gumpjete2a88c59.7a68-zhiyu-1gumpjete2a88c59-1339882768/images/dolphin_logo.png',
      success: res => {
        this.setData({ logoPath: res.tempFilePath });
      },
      fail: err => {
        console.error('LOGO下载失败:', err);
        // 设置默认logo或空值
        this.setData({ logoPath: '' });
      }
    });
  },
  
  // 添加删除聊天记录的方法
  async deleteChat() {
    // 历史记录不删除
    if (this.data.isHistory) return;
    
    try {
      await wx.cloud.callFunction({
        name: 'batchDeleteChats',
        data: {
          chatIds: [this.data.chatId],  // 修改为数组格式
          deleteReports: true  // 同时删除关联的报告
        }
      });
      console.log('已删除仅含单条消息的聊天记录:', this.data.chatId);
    } catch (error) {
      console.error('删除聊天记录失败:', error);
    }
  },

  // 加载用户分析数据
  async loadUserAnalysis() {
    try {
      // 先从本地存储获取
      const localAnalysis = wx.getStorageSync('userSummaryReport');
      if (localAnalysis && localAnalysis.content) {
        this.setData({ userAnalysis: localAnalysis });
        return;
      }

      // 如果本地没有，从数据库获取
      const db = wx.cloud.database();
      const result = await db.collection('user_imf').where({
        userId: this.data.userInfo.openid
      }).get();

      if (result.data && result.data.length > 0) {
        const analysis = result.data[0];
        this.setData({ userAnalysis: analysis });
        // 保存到本地存储
        wx.setStorageSync('userSummaryReport', analysis);
      }
    } catch (err) {
      console.error('加载用户分析数据失败:', err);
    }
  },
});