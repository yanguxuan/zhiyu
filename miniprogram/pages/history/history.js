Page({
    data: {
        historyList: [],
        loading: true
    },

    onLoad: function () {
        this.getHistoryList();
    },

    onShow: function () {
        this.getHistoryList();
    },

    // 获取历史对话列表
    async getHistoryList() {
        try {
            const { result } = await wx.cloud.callFunction({
                name: 'getHistoryChats',
            });

            this.setData({
                historyList: result.data.sort((a, b) => b.createTime - a.createTime),
                loading: false
            });
        } catch (error) {
            console.error('获取历史对话失败：', error);
            wx.showToast({
                title: '获取历史记录失败',
                icon: 'none'
            });
        }
    },

    // 删除历史对话
    async deleteChat(e) {
        const { chatId } = e.currentTarget.dataset;

        try {
            const res = await wx.showModal({
                title: '确认删除',
                content: '确定要删除这条历史对话吗？',
                confirmColor: '#ff4444'
            });

            if (res.confirm) {
                await wx.cloud.callFunction({
                    name: 'deleteHistoryChat',
                    data: { chatId }
                });

                wx.showToast({
                    title: '删除成功',
                    icon: 'success'
                });

                this.getHistoryList(); // 重新加载列表
            }
        } catch (error) {
            console.error('删除历史对话失败：', error);
            wx.showToast({
                title: '删除失败',
                icon: 'none'
            });
        }
    },

    // 继续历史对话
    continueChat(e) {
        const { chatId } = e.currentTarget.dataset;
        wx.navigateTo({
            url: `/pages/chat/chat?chatId=${chatId}&isHistory=true`
        });
    },

    // 开始新对话
    startNewChat() {
        wx.navigateTo({
            url: '/pages/chat/chat'
        });
    }
}); 