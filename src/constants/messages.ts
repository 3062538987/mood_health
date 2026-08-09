export const messages = {
  empty: {
    moodRecord: {
      title: '还没有情绪记录',
      description: '记录下今天的感受，让这里变得丰富起来吧',
      action: '开始记录',
    },
    moodAnalysis: {
      title: '还没有足够的情绪数据',
      description: '积累更多记录后，AI 会为你生成贴心的分析报告',
      action: '去记录情绪',
    },
    counselingHistory: {
      title: '还没有咨询记录',
      description: '有什么想聊的，随时可以开始对话',
      action: '开始咨询',
    },
    treeholePosts: {
      title: '这里空空如也',
      description: '分享你的心情，也许会有温暖的回应',
      action: '发布帖子',
    },
    courses: {
      title: '暂无课程',
      description: '更多心理成长课程正在准备中',
      action: '稍后再来',
    },
    activities: {
      title: '暂时没有活动',
      description: '新的团体辅导活动会陆续上线',
      action: '刷新看看',
    },
    achievements: {
      title: '还没有解锁成就',
      description: '完成任务解锁更多成就',
      action: '开始探索',
    },
  },

  error: {
    network: {
      title: '网络连接有点小问题',
      description: '请检查网络设置，或稍后再试',
      action: '再试一次',
    },
    server: {
      title: '服务暂时不太稳定',
      description: '我们正在努力恢复中，请稍后再试',
      action: '再试一次',
    },
    unauthorized: {
      title: '需要登录才能继续',
      description: '请登录后再进行操作',
      action: '去登录',
    },
    forbidden: {
      title: '没有访问权限',
      description: '请联系管理员获取相关权限',
      action: '返回首页',
    },
    notFound: {
      title: '页面找不到了',
      description: '也许是地址有误，或页面已被移除',
      action: '返回首页',
    },
    unexpected: {
      title: '遇到了一些意外',
      description: '系统正在处理这个问题',
      action: '再试一次',
    },
  },

  success: {
    moodRecord: {
      title: '记录已保存',
      description: '系统会自动分析你的情绪记录',
      action: '查看分析',
    },
    counselingSend: {
      title: '消息已发送',
      description: 'AI 正在思考如何回应',
      action: '继续对话',
    },
    treeholePost: {
      title: '发布成功',
      description: '你的心声已经传递出去',
      action: '查看帖子',
    },
    activityRegister: {
      title: '报名成功',
      description: '期待与你在活动中相遇',
      action: '查看活动',
    },
    profileUpdate: {
      title: '更新成功',
      description: '你的个人信息已更新',
      action: '完成',
    },
    passwordChange: {
      title: '修改成功',
      description: '新密码已生效',
      action: '完成',
    },
  },

  loading: {
    moodRecord: {
      title: '情绪记录正在准备中',
      description: '正在为你整理情绪类型和触发因素选项',
    },
    moodAnalysis: {
      title: '正在整理你的情绪内容',
      description: '界面会以更轻柔的方式出现，请稍等一下',
    },
    counseling: {
      title: '心理咨询正在准备',
      description: '让 AI 助手准备好倾听你的故事',
    },
    treehole: {
      title: '树洞正在开启',
      description: '为你营造一个安全的倾诉空间',
    },
    courses: {
      title: '课程列表正在加载',
      description: '精选的心理成长课程即将呈现',
    },
    activities: {
      title: '活动列表正在加载',
      description: '为你筛选适合的团体辅导活动',
    },
  },

  confirmation: {
    deleteMood: {
      title: '确认删除',
      description: '删除后无法恢复，确定要删除这条记录吗？',
      confirm: '确认删除',
      cancel: '取消',
    },
    deletePost: {
      title: '确认删除',
      description: '删除后帖子将不再显示',
      confirm: '确认删除',
      cancel: '取消',
    },
    logout: {
      title: '确认退出',
      description: '退出后需要重新登录',
      confirm: '确认退出',
      cancel: '取消',
    },
    clearHistory: {
      title: '确认清空',
      description: '清空后所有历史记录将被删除',
      confirm: '确认清空',
      cancel: '取消',
    },
  },
}