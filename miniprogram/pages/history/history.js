Page({
    data: {
        historyList: [],
        loading: true,
        isBatchDelete: false,
        isAllSelected: false
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

            // 过滤掉无效的记录
            const validChats = result.data.filter(chat => 
                chat && 
                chat._id && 
                chat.title && 
                chat.lastMessage && 
                chat.createTime
            );

            this.setData({
                historyList: validChats.sort((a, b) => b.createTime - a.createTime),
                loading: false
            });
        } catch (error) {
            console.error('获取历史对话失败：', error);
            wx.showToast({
                title: '获取历史记录失败',
                icon: 'none'
            });
            this.setData({
                loading: false,
                historyList: []
            });
        }
    },

    // 删除历史对话
    async deleteChat(e) {
        const { chatId } = e.currentTarget.dataset;
        if (!chatId) {
            wx.showToast({
                title: '无效的记录',
                icon: 'none'
            });
            return;
        }

        try {
            const res = await wx.showModal({
                title: '确认删除',
                content: '确定要删除这条历史对话吗？',
                confirmColor: '#ff4444'
            });

            if (res.confirm) {
                wx.showLoading({
                    title: '删除中...'
                });

                await wx.cloud.callFunction({
                    name: 'deleteHistoryChat',
                    data: { chatId }
                });

                // 直接在前端更新列表，而不是重新获取
                const newHistoryList = this.data.historyList.filter(item => item._id !== chatId);
                this.setData({
                    historyList: newHistoryList
                });

                wx.hideLoading();
                wx.showToast({
                    title: '删除成功',
                    icon: 'success'
                });
            }
        } catch (error) {
            console.error('删除历史对话失败：', error);
            wx.hideLoading();
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
    },

    toggleBatchDelete() {
        const { isBatchDelete, historyList } = this.data
        if (!isBatchDelete) {
            // 进入批量删除模式，为每个项目添加 selected 属性
            historyList.forEach(item => item.selected = false)
        }
        this.setData({
            isBatchDelete: !isBatchDelete,
            isAllSelected: false,
            historyList
        })
    },

    toggleSelect(e) {
        const { index } = e.currentTarget.dataset
        const { historyList } = this.data
        historyList[index].selected = !historyList[index].selected

        // 检查是否全选
        const isAllSelected = historyList.every(item => item.selected)

        this.setData({
            historyList,
            isAllSelected
        })
    },

    selectAll() {
        const { historyList, isAllSelected } = this.data
        historyList.forEach(item => item.selected = !isAllSelected)
        this.setData({
            historyList,
            isAllSelected: !isAllSelected
        })
    },

    async deleteSelected() {
        const { historyList } = this.data;
        const selectedIds = historyList.filter(item => item.selected && item._id).map(item => item._id);
        
        if (selectedIds.length === 0) {
            wx.showToast({
                title: '请选择要删除的对话',
                icon: 'none'
            });
            return;
        }

        const res = await wx.showModal({
            title: '确认删除',
            content: `确定要删除选中的 ${selectedIds.length} 个对话吗？`,
            confirmColor: '#ff4444'
        });

        if (res.confirm) {
            wx.showLoading({
                title: '删除中...'
            });

            try {
                await wx.cloud.callFunction({
                    name: 'batchDeleteChats',
                    data: { chatIds: selectedIds }
                });

                // 直接在前端更新列表
                const newHistoryList = historyList.filter(item => !selectedIds.includes(item._id));
                this.setData({
                    historyList: newHistoryList,
                    isBatchDelete: false
                });

                wx.hideLoading();
                wx.showToast({
                    title: '删除成功',
                    icon: 'success'
                });
            } catch (error) {
                console.error('批量删除失败：', error);
                wx.hideLoading();
                wx.showToast({
                    title: '删除失败',
                    icon: 'error'
                });
            }
        }
    }
}); 