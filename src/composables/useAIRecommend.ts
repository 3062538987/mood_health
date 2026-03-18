import { ref, computed } from 'vue'
import { useUserStore } from '@/stores/userStore'
import useRelaxStore from '@/stores/relaxStore'
import { debounce } from '@/utils/debounce'
import type { AIRecommendResult, AIRecommendItem } from '@/types/ai'

/**
 * AI推荐模块
 * 基于用户情绪数据推荐放松音乐/课程/活动
 */
export function useAIRecommend() {
  const userStore = useUserStore()
  const relaxStore = useRelaxStore()
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const recommendResult = ref<AIRecommendResult | null>(null)

  /**
   * 获取AI推荐
   * @param mood 情绪类型
   * @param limit 推荐数量
   * @returns 推荐结果
   */
  const getRecommendations = async (
    mood: string,
    limit: number = 5
  ): Promise<AIRecommendResult> => {
    isLoading.value = true
    error.value = null

    try {
      // 准备推荐参数
      const recommendParams = {
        mood,
        limit,
        userId: userStore.user?.id,
        userPreferences: getUserPreferences(),
        recentActivities: getRecentActivities(),
      }

      // P0下线: 后端暂无 /api/ai/recommend，保留结构并走本地推荐
      // const response = await request<AIRecommendResult>({
      //   url: buildAiApiUrl('/recommend'),
      //   method: 'post',
      //   data: recommendParams,
      // })

      const fallback = getLocalRecommendations(recommendParams.mood, recommendParams.limit)
      recommendResult.value = fallback
      return fallback
    } catch (err) {
      error.value = '推荐获取失败，请稍后重试'
      console.error('AI recommendation error:', err)
      // 本地fallback方案
      return getLocalRecommendations(mood, limit)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 防抖版本的获取推荐
   * @param mood 情绪类型
   * @param limit 推荐数量
   * @returns 推荐结果
   */
  const debouncedGetRecommendations = debounce((...args: unknown[]) => {
    const [mood, limit = 5] = args
    return getRecommendations(mood as string, limit as number)
  }, 500)

  /**
   * 获取用户偏好
   * @returns 用户偏好对象
   */
  const getUserPreferences = () => {
    // 从relaxStore获取用户的放松活动偏好
    const activityBreakdown = relaxStore.statistics?.activityBreakdown || []
    const preferences = activityBreakdown
      .sort((a, b) => b.count - a.count)
      .map((item) => item.type)
      .slice(0, 3)

    return preferences
  }

  /**
   * 获取最近的活动
   * @returns 最近活动列表
   */
  const getRecentActivities = () => {
    // 从relaxStore获取最近的放松活动
    return relaxStore.records
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, 5)
      .map((record) => ({
        type: record.activityType,
        duration: record.endTime
          ? new Date(record.endTime).getTime() - new Date(record.startTime).getTime()
          : 0,
        timestamp: record.startTime,
      }))
  }

  /**
   * 本地推荐fallback方案
   * @param mood 情绪类型
   * @param limit 推荐数量
   * @returns 推荐结果
   */
  const getLocalRecommendations = (mood: string, limit: number): AIRecommendResult => {
    // 基于情绪类型的本地推荐逻辑
    const recommendationsMap: Record<string, AIRecommendItem[]> = {
      开心: [
        {
          id: '1',
          type: 'music',
          title: '快乐时光',
          description: '轻快的音乐，适合保持愉悦的心情',
          url: '/relax/music/1',
          cover:
            'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=happy%20music%20album%20cover%20with%20bright%20colors&image_size=square',
          relevance: 0.9,
        },
        {
          id: '2',
          type: 'activity',
          title: '户外散步',
          description: '在阳光下散步，享受美好时光',
          url: '/improve/activity/2',
          cover:
            'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=outdoor%20walking%20in%20sunshine&image_size=square',
          relevance: 0.85,
        },
        {
          id: '3',
          type: 'course',
          title: '积极心理学',
          description: '学习如何保持积极的心态',
          url: '/improve/course/3',
          cover:
            'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=positive%20psychology%20course%20cover&image_size=square',
          relevance: 0.8,
        },
      ],
      焦虑: [
        {
          id: '4',
          type: 'music',
          title: '静心冥想',
          description: '舒缓的音乐，帮助缓解焦虑',
          url: '/relax/music/4',
          cover:
            'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=calm%20meditation%20music%20album%20cover&image_size=square',
          relevance: 0.9,
        },
        {
          id: '5',
          type: 'activity',
          title: '深呼吸练习',
          description: '通过深呼吸缓解焦虑情绪',
          url: '/improve/activity/5',
          cover:
            'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=deep%20breathing%20exercise&image_size=square',
          relevance: 0.85,
        },
        {
          id: '6',
          type: 'course',
          title: '压力管理',
          description: '学习有效的压力管理技巧',
          url: '/improve/course/6',
          cover:
            'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=stress%20management%20course%20cover&image_size=square',
          relevance: 0.8,
        },
      ],
      抑郁: [
        {
          id: '7',
          type: 'music',
          title: '希望之光',
          description: '温暖的音乐，给予希望和力量',
          url: '/relax/music/7',
          cover:
            'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=hopeful%20music%20album%20cover%20with%20warm%20light&image_size=square',
          relevance: 0.9,
        },
        {
          id: '8',
          type: 'activity',
          title: '社交互动',
          description: '与朋友交流，缓解孤独感',
          url: '/improve/activity/8',
          cover:
            'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=social%20interaction%20with%20friends&image_size=square',
          relevance: 0.85,
        },
        {
          id: '9',
          type: 'course',
          title: '情绪管理',
          description: '学习如何管理和改善情绪',
          url: '/improve/course/9',
          cover:
            'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=emotion%20management%20course%20cover&image_size=square',
          relevance: 0.8,
        },
      ],
      平静: [
        {
          id: '10',
          type: 'music',
          title: '宁静致远',
          description: '平和的音乐，保持内心的平静',
          url: '/relax/music/10',
          cover:
            'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=peaceful%20music%20album%20cover%20with%20calm%20landscape&image_size=square',
          relevance: 0.9,
        },
        {
          id: '11',
          type: 'activity',
          title: '瑜伽练习',
          description: '通过瑜伽保持身心平衡',
          url: '/improve/activity/11',
          cover:
            'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=yoga%20practice%20in%20peaceful%20setting&image_size=square',
          relevance: 0.85,
        },
        {
          id: '12',
          type: 'course',
          title: ' mindfulness',
          description: '学习正念技巧，保持当下',
          url: '/improve/course/12',
          cover:
            'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=mindfulness%20meditation%20course%20cover&image_size=square',
          relevance: 0.8,
        },
      ],
    }

    const recommendations = recommendationsMap[mood] || recommendationsMap['平静']
    const limitedRecommendations = recommendations.slice(0, limit)

    return {
      items: limitedRecommendations,
      strategy: '基于情绪类型的推荐',
      explanation: `根据您当前的${mood}情绪状态，为您推荐了相关的放松内容`,
    }
  }

  /**
   * 保存推荐点击记录
   * @param item 推荐项
   */
  const saveRecommendationClick = async (item: AIRecommendItem) => {
    try {
      if (userStore.isLoggedIn) {
        // P0下线: 后端暂无 /api/ai/recommend/click，暂不发请求
        // await request({
        //   url: buildAiApiUrl('/recommend/click'),
        //   method: 'post',
        //   data: {
        //     itemId: item.id,
        //     itemType: item.type,
        //     userId: userStore.user?.id,
        //   },
        // })
        void item
      }
    } catch (err) {
      console.error('Save recommendation click error:', err)
      // 不影响用户体验，静默处理错误
    }
  }

  return {
    isLoading,
    error,
    recommendResult,
    getRecommendations,
    debouncedGetRecommendations,
    saveRecommendationClick,
  }
}
