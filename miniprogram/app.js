// app.js
App({
  globalData: {
    userInfo: null,
    cloudEnv: 'zhiyu-1gumpjete2a88c59'
  },

  onLaunch: function() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'zhiyu-1gumpjete2a88c59', // 请将这里替换为你的云开发环境ID
        traceUser: true
      })
    }

    // 检查登录状态
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.globalData.userInfo = userInfo
    }

    // 检查更新
    this.checkUpdate()
  },

  // 检查更新
  checkUpdate: function() {
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager()
      updateManager.onCheckForUpdate((res) => {
        if (res.hasUpdate) {
          updateManager.onUpdateReady(() => {
            wx.showModal({
              title: '更新提示',
              content: '新版本已经准备好，是否重启应用？',
              success: (res) => {
                if (res.confirm) {
                  updateManager.applyUpdate()
                }
              }
            })
          })
          
          updateManager.onUpdateFailed(() => {
            wx.showModal({
              title: '更新提示',
              content: '新版本下载失败，请检查网络后重试',
              showCancel: false
            })
          })
        }
      })
    }
  },

  // 全局错误处理
  onError: function(err) {
    console.error('应用错误：', err)
    // 可以在这里添加错误上报逻辑
    wx.showToast({
      title: '系统出现错误',
      icon: 'none',
      duration: 2000
    })
  },

  // 全局未处理的Promise拒绝
  onUnhandledRejection: function(err) {
    console.error('未处理的Promise拒绝：', err)
  },

  // 页面不存在
  onPageNotFound: function(res) {
    console.error('页面不存在：', res.path)
    wx.reLaunch({
      url: '/pages/login/login',
      fail: (err) => {
        console.error('跳转失败：', err)
        wx.showToast({
          title: '系统出现错误',
          icon: 'none',
          duration: 2000
        })
      }
    })
  }
})
