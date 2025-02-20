// pages/information/information.js
Page({
    data: {
      userInfo: null,
      avatarUrl: '' // 用于存储用户头像 URL
    },
  
    onLoad: function (options) {
      const userInfo = wx.getStorageSync('userInfo');
      if (!userInfo) {
        wx.reLaunch({
          url: '/pages/login/login'
        });
        return;
      }

      this.setData({
        userInfo,
        avatarUrl: userInfo.avatarUrl // 获取用户头像 URL
      });
    }
  });
