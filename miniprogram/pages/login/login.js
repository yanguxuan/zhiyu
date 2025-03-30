const app = getApp()

Page({
  data: {
    agreed: false,
    loading: false,
    avatarUrl: '',
    nickName: '',
    hasAvatar: false,
    hasNickname: false,
    logoPath: '', // 用于存储下载后的 logo 图片路径
    defaultAvatarPath: '' // 用于存储下载后的 default-avatar 图片路径
  },

  onLoad() {
    // 检查是否已经登录
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      wx.reLaunch({
        url: '/pages/index/index'
      })
    }

    // 下载 logo 图片
    this.downloadLogoImage();
    // 下载 default-avatar 图片
    this.downloadDefaultAvatarImage();
  },

  onShow() {
    // 每次显示页面时重置状态
    this.setData({
      loading: false
    })
  },

  onAgreementChange(e) {
    console.log('协议状态改变：', e.detail.value)
    this.setData({
      agreed: e.detail.value.includes('agreed')
    })
    this.checkLoginButtonState()
  },

  // 处理头像选择
  onChooseAvatar(e) {
    console.log('选择头像：', e.detail.avatarUrl)
    const { avatarUrl } = e.detail
    this.setData({
      avatarUrl,
      hasAvatar: true
    })
    this.checkLoginButtonState()
  },

  // 处理昵称输入
  onInputNickname(e) {
    console.log('输入昵称：', e.detail.value)
    const { value } = e.detail
    this.setData({
      nickName: value,
      hasNickname: !!value.trim()
    })
    this.checkLoginButtonState()
  },

  // 检查登录按钮状态
  checkLoginButtonState() {
    const { agreed, hasAvatar, hasNickname, loading } = this.data
    console.log('当前状态：', {
      agreed,
      hasAvatar,
      hasNickname,
      loading
    })
  },

  // 处理登录
  async handleLogin() {
    console.log('尝试登录')
    if (!this.data.agreed) {
      wx.showToast({
        title: '请先同意用户协议和隐私政策',
        icon: 'none'
      })
      return
    }

    if (!this.data.hasAvatar || !this.data.nickName.trim()) {
      wx.showToast({
        title: '请选择头像并输入昵称',
        icon: 'none'
      })
      return
    }

    if (this.data.loading) return

    this.setData({ loading: true })

    try {
      // 检查云开发是否初始化
      if (!wx.cloud) {
        throw new Error('请使用 2.2.3 或以上的基础库以使用云能力')
      }

      // 先进行微信登录
      const loginRes = await wx.login()
      if (!loginRes || !loginRes.code) {
        throw new Error('微信登录失败，请重试')
      }

      // 调用登录云函数
      const { result } = await wx.cloud.callFunction({
        name: 'login',
        data: {
          code: loginRes.code
        }
      })

      if (!result || result.error) {
        throw new Error(result?.error || '登录失败，请重试')
      }

      // 更新用户信息
      await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'update',
          userInfo: {
            avatarUrl: this.data.avatarUrl,
            nickName: this.data.nickName.trim()
          }
        }
      }).catch(err => {
        console.error('更新用户信息失败:', err)
      })

      // 保存用户基本信息到user_info集合
      await wx.cloud.callFunction({
        name: 'saveUserInfo',
        data: {
          collection: 'user_info',
          data: {
            userId: result.openid,
            nickName: this.data.nickName.trim(),
            avatarUrl: this.data.avatarUrl,
            registerTime: new Date(),
            lastLoginTime: new Date()
          }
        }
      }).catch(err => {
        console.error('保存用户信息到user_info失败:', err)
      })

      // 保存用户信息到本地
      const userInfo = {
        avatarUrl: this.data.avatarUrl,
        nickName: this.data.nickName.trim(),
        openid: result.openid
      }
      wx.setStorageSync('userInfo', userInfo)
      app.globalData.userInfo = userInfo

      // 显示成功提示并跳转
      wx.showToast({
        title: '登录成功',
        icon: 'success',
        mask: true,
        duration: 1500
      })

      // 延迟跳转
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/index/index',
          fail: (err) => {
            console.error('跳转失败：', err)
            wx.showToast({
              title: '跳转失败，请重试',
              icon: 'none'
            })
          }
        })
      }, 1500)

    } catch (err) {
      console.error('登录失败：', err)
      wx.showModal({
        title: '登录失败',
        content: err.message || '登录失败，请重试',
        showCancel: false
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  showAgreement() {
    wx.showModal({
      title: '用户协议',
      content: '感谢您使用知心阿姨！我们致力于为您提供优质的亲子沟通咨询服务。使用本服务即表示您同意遵守我们的用户协议。',
      showCancel: false
    })
  },

  showPrivacy() {
    wx.showModal({
      title: '隐私政策',
      content: '我们重视您的隐私保护。我们只会收集必要的信息用于提供服务，并采取严格的措施保护您的个人信息安全。',
      showCancel: false
    })
  },

  downloadLogoImage: function() {
    const fileID = '	cloud://zhiyu-1gumpjete2a88c59.7a68-zhiyu-1gumpjete2a88c59-1339882768/images/dolphin_logo.png'; // 替换为您的文件 ID

    wx.cloud.downloadFile({
      fileID: fileID,
      success: res => {
        console.log('下载 logo 成功，临时文件路径:', res.tempFilePath);
        this.setData({
          logoPath: res.tempFilePath // 将临时文件路径存储到页面数据中
        });
      },
      fail: err => {
        console.error('下载 logo 失败:', err);
      }
    });
  },

  downloadDefaultAvatarImage: function() {
    const fileID = 'cloud://zhiyu-1gumpjete2a88c59.7a68-zhiyu-1gumpjete2a88c59-1339882768/images/default-avatar.png'; // 替换为您的 default-avatar 文件 ID

    wx.cloud.downloadFile({
      fileID: fileID,
      success: res => {
        console.log('下载 default-avatar 成功，临时文件路径:', res.tempFilePath);
        this.setData({
          defaultAvatarPath: res.tempFilePath // 将临时文件路径存储到页面数据中
        });
      },
      fail: err => {
        console.error('下载 default-avatar 失败:', err);
      }
    });
  }
})