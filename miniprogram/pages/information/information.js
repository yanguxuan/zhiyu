// pages/information/information.js
Page({
    data: {
      userInfo: null,
      avatarUrl: '', // 用于存储用户头像 URL
      familyInfo: {
        memberCount: '',
        childrenCount: '',
        childrenGender: '',
        parentRelation: '',
        interaction: '',
        living: ''
      }, // 存储家庭基本信息
      detailedInfo: {
        familyForm: '',
        familyStructure: '',
        memberProfiles: '',
        coupleRelation: '',
        parentChildRelation: '',
        memberRelations: '',
        childrenGrowth: '',
        childrenPersonality: '',
        childrenStudy: '',
        childrenSocial: '',
        mainProblems: '',
        familyConflicts: '',
        problemSolving: ''
      }, // 存储家庭详细信息
      loadingFamilyInfo: false, // 加载状态
      userSummary: null,
      loadingSummary: false,
      familyFormOptions: ['正常家庭', '单亲家庭', '离异家庭', '重组家庭', '其他'],
      showButtons: false // 控制按钮组是否显示
    },
  
    onLoad: function (options) {
      const userInfo = wx.getStorageSync('userInfo');
      if (!userInfo) {
        wx.reLaunch({
          url: '/pages/login/login'
        });
        return;
      }
  
      // 检查头像URL是否存在，如果不存在则使用默认头像
      const avatarUrl = userInfo.avatarUrl || 'cloud://zhiyu-1gumpjete2a88c59.7a68-zhiyu-1gumpjete2a88c59-1339882768/images/default-avatar.png';
      
      this.setData({
        userInfo,
        avatarUrl: avatarUrl
      });
      
      // 尝试从本地存储加载家庭信息
      this.loadFamilyInfoFromStorage();
      // 加载已有的总结报告
      this.loadUserSummary();
    },
    
    // 从本地存储加载家庭信息
    loadFamilyInfoFromStorage() {
      const savedFamilyInfo = wx.getStorageSync('familyInfo');
      const savedDetailedInfo = wx.getStorageSync('detailedFamilyInfo');
      
      if (savedFamilyInfo) {
        this.setData({ familyInfo: savedFamilyInfo });
      }
      
      if (savedDetailedInfo) {
        this.setData({ detailedInfo: savedDetailedInfo });
      }
    },
    
    // 跳转到总结页面
    navigateToSummary() {
      wx.navigateTo({
        url: '/pages/summary/summary'
      });
    },
    
    // 生成家庭信息总结
    async generateFamilyInfo() {
      if (this.data.loadingFamilyInfo) return;
      
      this.setData({ loadingFamilyInfo: true });
      wx.showLoading({ title: '正在分析家庭信息...' });
      
      try {
        // 1. 获取所有历史对话
        const { result } = await wx.cloud.callFunction({
          name: 'getHistoryChats'
        });

        if (!result || result.code !== 0) {
          throw new Error('获取历史对话失败');
        }

        // 2. 准备历史对话数据
        const allChats = result.data || [];
        
        if (allChats.length === 0) {
          throw new Error('没有找到历史对话记录');
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

        // 4. 调用家庭信息总结机器人
        const familyBotId = "bot-e8f7e5b9"; // 家庭信息总结机器人ID
        
        // 在小程序端调用AI能力
        const res = await wx.cloud.extend.AI.bot.sendMessage({
          data: {
            botId: familyBotId,
            msg: "请根据我们的对话历史，总结我的家庭信息，并以表格形式呈现，包含家庭成员数量、孩子数量、孩子性别、父母关系状态、父母与孩子互动情况、居住情况等信息。",
            history: allMessages.slice(-50) // 限制历史记录数量，避免超出限制
          }
        });
        
        let fullResponse = '';
        for await (const event of res.eventStream) {
          if (event.data === '[DONE]') break;
          
          try {
            const data = JSON.parse(event.data);
            fullResponse += data.content || '';
          } catch (e) {
            console.error('数据解析错误:', e);
          }
        }
        
        // 5. 解析表格数据
        const familyInfo = this.parseFamilyTable(fullResponse.trim());
        
        this.setData({ 
          familyInfo,
          loadingFamilyInfo: false
        });
        
        wx.hideLoading();
        wx.showToast({
          title: '家庭信息分析完成',
          icon: 'success'
        });
      } catch (err) {
        console.error('家庭信息生成失败:', err);
        this.setData({ loadingFamilyInfo: false });
        wx.hideLoading();
        wx.showToast({
          title: err.message || '家庭信息生成失败',
          icon: 'none'
        });
      }
    },
    
    // 解析家庭信息表格
    parseFamilyTable(text) {
      // 查找表格内容
      const tableRegex = /\|\s*家庭成员数量\s*\|\s*孩子数量\s*\|\s*孩子性别\s*\|\s*父母关系状态\s*\|\s*父母与孩子互动情况\s*\|\s*居住情况\s*\|[\s\S]*?\|\s*([^|]*)\s*\|\s*([^|]*)\s*\|\s*([^|]*)\s*\|\s*([^|]*)\s*\|\s*([^|]*)\s*\|\s*([^|]*)\s*\|/;
      const match = text.match(tableRegex);
      
      if (!match) return null;
      
      return {
        memberCount: match[1].trim(),
        childrenCount: match[2].trim(),
        childrenGender: match[3].trim(),
        parentRelation: match[4].trim(),
        interaction: match[5].trim(),
        living: match[6].trim()
      };
    },
    
    // 更新基本家庭信息
    updateFamilyInfo(e) {
      const field = e.currentTarget.dataset.field;
      const value = e.detail.value;
      
      this.setData({
        [`familyInfo.${field}`]: value
      });
    },
    
    // 更新详细家庭信息
    updateDetailedInfo(e) {
      const field = e.currentTarget.dataset.field;
      const value = e.detail.value;
      
      this.setData({
        [`detailedInfo.${field}`]: value
      });
    },
    
    // 保存家庭信息
    saveFamilyInfo() {
      wx.showLoading({
        title: '保存中...'
      });
      
      // 保存到本地存储
      wx.setStorageSync('familyInfo', this.data.familyInfo);
      wx.setStorageSync('detailedFamilyInfo', this.data.detailedInfo);
      
      setTimeout(() => {
        wx.hideLoading();
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
      }, 500);
    },
    
    // 加载用户总结报告
    loadUserSummary: async function() {
      try {
        // 先尝试从本地存储获取
        const localSummary = wx.getStorageSync('userSummaryReport');
        if (localSummary && localSummary.content) {
          // 解析内容
          const parsedSummary = this.parseSummaryContent(localSummary.content);
          
          this.setData({
            summaryData: localSummary.content,
            parsedSummary: parsedSummary,
            hasSummary: true
          });
          return;
        }
        
        // 如果本地没有，从数据库获取
        const userInfo = wx.getStorageSync('userInfo');
        if (!userInfo || !userInfo.openid) {
          console.error('用户信息不完整，无法加载总结报告');
          this.setData({ hasSummary: false });
          return;
        }
        
        const db = wx.cloud.database();
        const result = await db.collection('user_imf').where({
          _openid: userInfo.openid
        }).get();
        
        console.log('查询总结报告结果:', result);
        
        if (result.data && result.data.length > 0 && result.data[0].content) {
          // 直接使用内容
          const summaryContent = result.data[0].content;
          
          // 解析内容
          const parsedSummary = this.parseSummaryContent(summaryContent);
          
          // 保存到本地缓存
          wx.setStorageSync('userSummaryReport', {
            content: summaryContent,
            updateTime: result.data[0].updateTime || new Date().toLocaleString()
          });
          
          this.setData({
            summaryData: summaryContent,
            parsedSummary: parsedSummary,
            hasSummary: true
          });
        } else {
          this.setData({
            hasSummary: false
          });
        }
      } catch (err) {
        console.error('加载总结报告失败:', err);
        this.setData({
          hasSummary: false
        });
      }
    },

    // 解析总结报告内容
    parseSummaryContent: function(content) {
      if (!content) return {};
      
      try {
        // 提取表格部分
        const behaviorTable = [];
        const tableRegex = /\|\s*(.*?)\s*\|\s*(.*?)\s*\|/g;
        let match;
        
        // 跳过表头
        let isHeader = true;
        
        while ((match = tableRegex.exec(content)) !== null) {
          if (isHeader) {
            isHeader = false;
            continue;
          }
          
          if (match[1] && match[2]) {
            behaviorTable.push({
              explicit: match[1].trim().replace(/[""]/g, ''),
              implicit: match[2].trim().replace(/[\[\]]/g, '')
            });
          }
        }
        
        // 提取干预建议部分
        let intervention = '';
        const interventionMatch = content.match(/▍干预建议([\s\S]*?)(?:▍|$)/);
        if (interventionMatch && interventionMatch[1]) {
          intervention = interventionMatch[1].trim();
        }
        
        // 提取知识应用部分
        let knowledge = '';
        const knowledgeMatch = content.match(/\[KNOWLEDGE应用\]([\s\S]*?)(?:$)/);
        if (knowledgeMatch && knowledgeMatch[1]) {
          knowledge = knowledgeMatch[1].trim();
        }
        
        return {
          behaviorTable,
          intervention,
          knowledge
        };
      } catch (error) {
        console.error('解析总结报告内容失败:', error);
        return {};
      }
    }, // 添加逗号以分隔函数定义

    // 切换按钮显示状态
    toggleButtons() {
      this.setData({
        showButtons: !this.data.showButtons
      });
    }
});
