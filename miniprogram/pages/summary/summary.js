// pages/summary/summary.js
Page({
  data: {
    loading: true,
    progress: 0,
    summaryData: [],
    error: null,
    userInfo: null
  },

  onLoad: function(options) {
    // 先获取用户信息
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo || !userInfo.openid) {  // 修改为小写的 openid
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        complete: () => {
          setTimeout(() => {
            wx.navigateTo({
              url: '/pages/login/login'
            });
          }, 1500);
        }
      });
      return;
    }
    
    this.setData({ userInfo });
    this.generateSummary();
  },

  // 生成总结报告
  generateSummary: async function() {
    try {
      // 1. 获取所有历史对话
      this.setData({ progress: 10 });
      const { result } = await wx.cloud.callFunction({
        name: 'getHistoryChats'
      });

      if (!result || result.code !== 0) {
        throw new Error('获取历史对话失败');
      }

      // 2. 准备历史对话数据
      this.setData({ progress: 30 });
      const allChats = result.data || [];
      
      if (allChats.length === 0) {
        // 没有历史对话，直接跳转回information页面
        this.navigateToInformation();
        return;
      }

      // 3. 合并所有对话消息
      const allMessages = [];
      allChats.forEach(chat => {
        if (chat.messages && chat.messages.length > 0) {
          chat.messages.forEach(msg => {
            if (msg.selectable !== false) {
              allMessages.push({
                role: msg.type === 'user' ? 'user' : 'assistant',
                content: msg.content
              });
            }
          });
        }
      });

      this.setData({ progress: 50 });

      // 4. 调用总结机器人
      const summaryBotId = "bot-8995acfa"; // 总结报告机器人ID
      
      // 在小程序端调用AI能力
      const res = await wx.cloud.extend.AI.bot.sendMessage({
        data: {
          botId: summaryBotId,
          msg: `请对用户的历史对话进行全面分析，生成详细的用户画像报告。请严格按照以下格式和字数要求生成报告：

1. ▍用户行为分析表（每项50-100字）
   - 显性行为：用户直接表达的需求和行为（3-5条）
   - 隐性行为：通过对话推断出的潜在需求和行为模式（3-5条）

2. ▍情感倾向分析（每项30-50字）
   - 主要情绪状态（2-3点）
   - 情绪波动规律（2-3点）
   - 压力源识别（2-3点）

3. ▍兴趣点分析（每项30-50字）
   - 主要关注领域（2-3点）
   - 重复提及的话题（2-3点）
   - 深入讨论的内容（2-3点）

4. ▍交互模式分析（每项30-50字）
   - 对话频率（2-3点）
   - 回应积极度（2-3点）
   - 问题类型偏好（2-3点）

5. ▍核心问题诊断（200-300字）
   - 主要困扰（1-2点）
   - 问题根源（1-2点）
   - 发展趋势（1-2点）

6. ▍干预策略设计（300-400字）
   - 短期建议（2-3点）
   - 中长期规划（2-3点）
   - 具体执行步骤（3-5点）

请确保：
1. 每个部分都严格按照上述格式和字数要求
2. 使用简洁、专业的语言
3. 保持客观、中立的分析态度
4. 建议要具体、可执行
5. 避免重复和冗余内容`,
          history: allMessages.slice(-50) // 限制历史记录数量，避免超出限制
        }
      });
      
      this.setData({ progress: 70 });
      
      let fullResponse = '';
      for await (const event of res.eventStream) {
        if (event.data === '[DONE]') break;
        
        try {
          const data = JSON.parse(event.data);
          fullResponse += data.content || '';
          // 更新进度
          this.setData({ progress: 70 + Math.floor(Math.random() * 20) });
        } catch (e) {
          console.error('数据解析错误:', e);
        }
      }
      
      const summary = fullResponse.trim();
      
      // 5. 解析总结表格
      const parsedData = this.parseSummaryTable(summary);
      
      // 保存到本地存储
      this.saveToLocalStorage(summary, parsedData);
      
      // 保存到数据库
      try {
        await this.saveUserSummary(summary, false);
      } catch (saveErr) {
        console.error('保存总结报告失败:', saveErr);
      }
      
      // 无论成功失败，都直接跳转
      this.navigateToInformation();
      
    } catch (err) {
      console.error('总结生成失败:', err);
      // 即使出错也直接跳转
      this.navigateToInformation();
    }
  },

  parseSummaryTable: function(summary) {
    try {
      if (!summary || typeof summary !== 'string') {
        console.error('无效的总结内容:', summary);
        return this.getEmptySummaryData();
      }
      
      // 验证报告格式
      if (!this.validateSummaryFormat(summary)) {
        console.error('报告格式不符合要求');
        return this.getEmptySummaryData();
      }
      
      // 提取用户行为分析表
      const behaviorMatch = summary.match(/▍用户行为分析表([\s\S]*?)▍情感倾向分析/);
      const behaviorTable = behaviorMatch ? behaviorMatch[1] : '';
      
      // 提取情感倾向分析
      const emotionMatch = summary.match(/▍情感倾向分析([\s\S]*?)▍兴趣点分析/);
      const emotionText = emotionMatch ? emotionMatch[1] : '';
      
      // 提取兴趣点分析
      const interestMatch = summary.match(/▍兴趣点分析([\s\S]*?)▍交互模式分析/);
      const interestText = interestMatch ? interestMatch[1] : '';
      
      // 提取交互模式分析
      const interactionMatch = summary.match(/▍交互模式分析([\s\S]*?)▍核心问题诊断/);
      const interactionText = interactionMatch ? interactionMatch[1] : '';
      
      // 提取核心问题诊断
      const diagnosisMatch = summary.match(/▍核心问题诊断([\s\S]*?)▍干预策略设计/);
      const diagnosis = diagnosisMatch ? diagnosisMatch[1] : '';
      
      // 提取干预策略
      const strategyMatch = summary.match(/▍干预策略设计([\s\S]*?)(?:\[KNOWLEDGE|$)/);
      const strategy = strategyMatch ? strategyMatch[1] : '';

      // 解析行为分析表格数据
      const tableData = this.parseBehaviorTable(behaviorTable);

      // 解析情感分析数据
      const emotionalAnalysis = {
        emotionalState: this.extractBulletPoints(emotionText, '主要情绪状态'),
        emotionalPattern: this.extractBulletPoints(emotionText, '情绪波动规律'),
        stressors: this.extractBulletPoints(emotionText, '压力源识别')
      };

      // 解析兴趣分析数据
      const interestAnalysis = {
        mainInterests: this.extractBulletPoints(interestText, '主要关注领域'),
        repeatedTopics: this.extractBulletPoints(interestText, '重复提及的话题'),
        deepDiscussions: this.extractBulletPoints(interestText, '深入讨论的内容')
      };

      // 解析交互模式数据
      const interactionAnalysis = {
        frequency: this.extractBulletPoints(interactionText, '对话频率'),
        responsiveness: this.extractBulletPoints(interactionText, '回应积极度'),
        questionPreference: this.extractBulletPoints(interactionText, '问题类型偏好')
      };

      // 验证各部分数据
      const validatedData = {
        behaviorAnalysis: this.validateBehaviorAnalysis(tableData),
        emotionalAnalysis: this.validateEmotionalAnalysis(emotionalAnalysis),
        interestAnalysis: this.validateInterestAnalysis(interestAnalysis),
        interactionAnalysis: this.validateInteractionAnalysis(interactionAnalysis),
        diagnosis: this.validateDiagnosis(diagnosis),
        strategy: this.validateStrategy(strategy)
      };

      return validatedData;
    } catch (err) {
      console.error('解析总结内容失败:', err);
      return this.getEmptySummaryData();
    }
  },

  // 获取空的总结数据结构
  getEmptySummaryData: function() {
    return {
      behaviorAnalysis: [],
      emotionalAnalysis: {
        emotionalState: [],
        emotionalPattern: [],
        stressors: []
      },
      interestAnalysis: {
        mainInterests: [],
        repeatedTopics: [],
        deepDiscussions: []
      },
      interactionAnalysis: {
        frequency: [],
        responsiveness: [],
        questionPreference: []
      },
      diagnosis: '',
      strategy: ''
    };
  },

  // 验证报告格式
  validateSummaryFormat: function(summary) {
    const requiredSections = [
      '▍用户行为分析表',
      '▍情感倾向分析',
      '▍兴趣点分析',
      '▍交互模式分析',
      '▍核心问题诊断',
      '▍干预策略设计'
    ];

    return requiredSections.every(section => summary.includes(section));
  },

  // 解析行为分析表格
  parseBehaviorTable: function(behaviorTable) {
    return behaviorTable.split('\n')
      .filter(line => line.includes('|'))
      .map(line => {
        const cells = line.split('|').map(cell => cell.trim()).filter(Boolean);
        if (cells.length >= 2) {
          return {
            explicit: cells[0].replace(/[""]/g, ''),
            implicit: cells[1].replace(/[\[\]]/g, '')
          };
        }
        return null;
      })
      .filter(item => item !== null);
  },

  // 验证行为分析数据
  validateBehaviorAnalysis: function(data) {
    if (!Array.isArray(data)) return [];
    return data.slice(0, 5); // 限制最多5条记录
  },

  // 验证情感分析数据
  validateEmotionalAnalysis: function(data) {
    const validateArray = (arr) => Array.isArray(arr) ? arr.slice(0, 3) : [];
    return {
      emotionalState: validateArray(data.emotionalState),
      emotionalPattern: validateArray(data.emotionalPattern),
      stressors: validateArray(data.stressors)
    };
  },

  // 验证兴趣分析数据
  validateInterestAnalysis: function(data) {
    const validateArray = (arr) => Array.isArray(arr) ? arr.slice(0, 3) : [];
    return {
      mainInterests: validateArray(data.mainInterests),
      repeatedTopics: validateArray(data.repeatedTopics),
      deepDiscussions: validateArray(data.deepDiscussions)
    };
  },

  // 验证交互模式数据
  validateInteractionAnalysis: function(data) {
    const validateArray = (arr) => Array.isArray(arr) ? arr.slice(0, 3) : [];
    return {
      frequency: validateArray(data.frequency),
      responsiveness: validateArray(data.responsiveness),
      questionPreference: validateArray(data.questionPreference)
    };
  },

  // 验证诊断内容
  validateDiagnosis: function(diagnosis) {
    if (!diagnosis) return '';
    // 限制诊断内容在200-300字之间
    return diagnosis.length > 300 ? diagnosis.substring(0, 300) + '...' : diagnosis;
  },

  // 验证策略内容
  validateStrategy: function(strategy) {
    if (!strategy) return '';
    // 限制策略内容在300-400字之间
    return strategy.length > 400 ? strategy.substring(0, 400) + '...' : strategy;
  },

  // 辅助函数：提取带有特定标题的要点
  extractBulletPoints: function(text, title) {
    const pattern = new RegExp(`${title}[：:](.*?)(?=\\n\\s*-|$)`, 's');
    const match = text.match(pattern);
    if (!match) return [];
    
    return match[1].split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('-'))
      .map(line => line.substring(1).trim());
  },

  // 新增：保存到本地存储的辅助函数
  saveToLocalStorage: function(summary, parsedData) {
    // 保存完整格式
    wx.setStorageSync('userSummaryReport', {
      content: summary,
      parsedContent: parsedData,
      updateTime: new Date().toLocaleString()
    });
    
    // 保存为userSummary格式
    wx.setStorageSync('userSummary', {
      data: parsedData,
      content: summary,
      timestamp: Date.now()
    });
    
    // 保存行为分析数组
    wx.setStorageSync('summaryBehaviorData', parsedData.behaviorAnalysis || []);
    
    console.log('本地存储已保存');
  },

  saveUserSummary: async function(summaryContent, shouldNavigateBack = true) {
    try {
      const userInfo = this.data.userInfo;
      if (!userInfo || !userInfo.openid) {
        console.error('用户信息不完整:', userInfo);
        throw new Error('用户信息不完整，无法保存总结报告');
      }
      
      const db = wx.cloud.database();
      const parsedContent = this.parseSummaryTable(summaryContent);
      
      // 准备要保存的数据
      const summaryData = {
        content: summaryContent,
        parsedContent: parsedContent,
        updateTime: new Date().toLocaleString(),
        userId: userInfo.openid
      };
      
      console.log('准备保存的数据:', summaryData);
      
      // 先查询是否已有记录
      const result = await db.collection('user_imf').where({
        userId: userInfo.openid
      }).get();
      
      console.log('查询结果:', result);
      
      if (result.data && result.data.length > 0) {
        // 更新现有记录
        await db.collection('user_imf').doc(result.data[0]._id).update({
          data: {
            content: summaryData.content,
            parsedContent: summaryData.parsedContent,
            updateTime: summaryData.updateTime,
            userId: summaryData.userId
          }
        });
        console.log('更新记录成功');
      } else {
        // 创建新记录
        const addResult = await db.collection('user_imf').add({
          data: summaryData
        });
        console.log('创建新记录成功:', addResult);
      }
      
      // 显示成功提示
      wx.showToast({
        title: '报告保存成功',
        icon: 'success',
        duration: 1000
      });
      
      // 移除自动跳转逻辑，由generateSummary统一处理
      return true;
    } catch (err) {
      console.error('保存总结报告失败:', err);
      wx.showToast({
        title: '保存失败',
        icon: 'none',
        duration: 1000
      });
      return false;
    }
  },
  
  // 新增：统一处理跳转到information页面的逻辑
  navigateToInformation: function() {
    // 先尝试刷新上一页数据
    const pages = getCurrentPages();
    if (pages.length > 1) {
      const prevPage = pages[pages.length - 2];
      if (prevPage && typeof prevPage.loadUserSummary === 'function') {
        try {
          // 调用上一页的刷新方法
          prevPage.loadUserSummary();
        } catch (e) {
          console.error('刷新上一页数据失败:', e);
        }
      }
      
      // 返回上一页
      wx.navigateBack();
    } else {
      // 如果没有上一页，则重定向到information页面
      wx.redirectTo({
        url: '/pages/information/information'
      });
    }
  },
  
  // 保留goBack函数，但内部调用navigateToInformation
  goBack: function() {
    this.navigateToInformation();
  },
});