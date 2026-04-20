import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import normalImg from '@/assets/normal.png'
// Sidebar avatars (hand-crafted)
import avatarZengzhang from '@/assets/增长黑客.png'
import avatarJinqianbao from '@/assets/金钱豹.png'
import avatarChengxuyuan from '@/assets/程序猿.png'
import avatarVangogh from '@/assets/梵高.png'
import avatarDashi from '@/assets/大师.png'
// Card illustrations (character art)
import cardZengzhang from '@/assets/Scientist.png'
import cardJinqianbao from '@/assets/stock.png'
import cardChengxuyuan from '@/assets/Coder.png'
import cardVangogh from '@/assets/Painter.png'
import cardDashi from '@/assets/Diviner.png'
import cardSinger from '@/assets/Singer.png'

export interface MockAgent {
  id: string
  name: string
  description: string
  gradient: string
  initial: string
  fakeTasks: string[]
  avatar?: string      // sidebar / chat avatar
  cardImage?: string   // large illustration for the new-agent card
}

export const ALL_PRESETS: MockAgent[] = [
  { id: 'default',      name: '阿虾',     description: '通用对话，随时为你服务',           gradient: 'ember',  initial: 'A', fakeTasks: [], avatar: normalImg },
  { id: 'xiaohongshu',  name: '增长黑客', description: '小红书内容运营与数据分析',         gradient: 'rose',   initial: 'Z', fakeTasks: ['爆款标题批量生成', '发布夏日穿搭笔记', '粉丝增长数据报告'], avatar: avatarZengzhang, cardImage: cardZengzhang },
  { id: 'jinqianbao',   name: '金钱豹',   description: '股票行情分析与持仓追踪',           gradient: 'gold',   initial: 'J', fakeTasks: ['今日沪深 300 涨跌分析', '茅台近 30 日 K 线复盘', '仓位调整建议'],    avatar: avatarJinqianbao, cardImage: cardJinqianbao },
  { id: 'codeMonkey',   name: '程序猿',   description: '代码开发、调试与代码审查',         gradient: 'ocean',  initial: 'C', fakeTasks: ['修复用户登录超时 Bug', '重构支付模块', '补全单元测试覆盖'],         avatar: avatarChengxuyuan, cardImage: cardChengxuyuan },
  { id: 'vangogh',      name: '梵高',     description: '像素风格插画与场景创作',           gradient: 'aurora', initial: 'F', fakeTasks: ['生成赛博朋克城市图', '设计游戏角色立绘', '制作像素表情包'],        avatar: avatarVangogh, cardImage: cardVangogh },
  { id: 'tianluo',      name: '大师',     description: '生活规划、饮食与出行安排',         gradient: 'sage',   initial: 'D', fakeTasks: ['规划本周健康饮食', '订机票去丽江旅行'],                           avatar: avatarDashi, cardImage: cardDashi },
  { id: 'singer',       name: '创作歌手', description: '歌词创作、编曲灵感与音乐风格分析', gradient: 'aurora', initial: 'C', fakeTasks: ['写一首关于离别的歌词', '给这段旋律填词', '推荐同类风格歌手'], cardImage: cardSinger },
]

export const useMockAgentStore = defineStore('mockAgents', () => {
  const agents = ref<MockAgent[]>([{ ...ALL_PRESETS[0] }])
  const selectedAgentId = ref<string>('default')

  const availablePresets = computed(() =>
    ALL_PRESETS.slice(1).filter(p => !agents.value.find(a => a.id === p.id))
  )

  function addAgent(preset: MockAgent) {
    if (!agents.value.find(a => a.id === preset.id)) {
      agents.value.push({ ...preset })
    }
    selectedAgentId.value = preset.id
  }

  function selectAgent(id: string) {
    selectedAgentId.value = id
  }

  return { agents, selectedAgentId, availablePresets, addAgent, selectAgent }
})
