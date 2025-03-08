// pages/index/index.js
const app = getApp()

Page({

  /**
   * 页面的初始数据
   */
  data: {
    dolphinLogoPath: '',
    userInfo: null,
    isNavOpen: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 获取本地存储的用户信息
    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo) {
      wx.reLaunch({
        url: '../login/login'
      })
      return
    }
    
    this.setData({
      userInfo
    })

    // 下载 dolphin_logo
    this.downloadDolphinLogo();
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
    // 每次显示页面时检查登录状态
    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo) {
      wx.reLaunch({
        url: '../login/login'
      })
      return
    }
    
    if (JSON.stringify(userInfo) !== JSON.stringify(this.data.userInfo)) {
      this.setData({
        userInfo
      })
    }
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

  // 开始咨询
  startChat() {
    const userInfo = this.data.userInfo
    if (!userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    wx.navigateTo({
      url: '/pages/chat/chat',
      fail: (err) => {
        console.error('跳转到聊天页面失败：', err)
        wx.showToast({
          title: '进入聊天失败，请重试',
          icon: 'none'
        })
      }
    })
  },

  goToInformation: function () {
    wx.navigateTo({
      url: '/pages/information/information'
    });
  },

  // 跳转到历史对话
  goToHistory() {
    wx.navigateTo({
      url: '/pages/history/history'
    });
  },

  onTopic1Click: function() {
    wx.navigateTo({
      url: '/pages/hottopic_1/hottopic_1' // 跳转到 hottopic_1 页面
    });
  },

  onTopic2Click: function() {
    wx.navigateTo({
      url: '/pages/hottopic_2/hottopic_2' // 跳转到 hottopic_2 页面
    });
  },

  onTopic3Click: function() {
    wx.navigateTo({
      url: '/pages/hottopic_3/hottopic_3' // 跳转到 hottopic_3 页面
    });
  },

  toggleNav() {
    this.setData({
      isNavOpen: !this.data.isNavOpen
    });
  },

  navTo(e) {
    const page = e.currentTarget.dataset.page;
    wx.navigateTo({
      url: `../${page}/${page}`
    });
    this.setData({
      isNavOpen: false
    });
  },

  downloadDolphinLogo() {
    wx.cloud.downloadFile({
      fileID: 'cloud://zhiyu-1gumpjete2a88c59.7a68-zhiyu-1gumpjete2a88c59-1339882768/images/dolphin_logo.png',
      success: res => {
        this.setData({
          dolphinLogoPath: res.tempFilePath
        });
      },
      fail: err => {
        console.error('海豚logo下载失败:', err);
      }
    });
  },
})