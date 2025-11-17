import type { ThemeConfig } from 'antd';

// UX设计规范中的色彩系统 - 专业蓝调
export const themeColors = {
  // 主色调 - 专业深蓝色系
  primary: '#0052CC',      // 专业深蓝 - 传达信任、稳重和专业性
  primaryLight: '#0065FF', // 亮蓝色 - 用于悬停和高亮
  primaryDark: '#003D99',  // 深蓝色 - 用于按下状态
  insight: '#5243AA',      // 深紫蓝 - 强调数据智能和洞察能力

  // 辅助色
  secondary: '#2C5282',    // 石板蓝 - 辅助色调
  accent: '#4A90E2',       // 天蓝色 - 强调色

  // 功能色
  success: '#00875A',      // 深绿色 - 表示数据可用和成功状态
  warning: '#FF991F',      // 橙色 - 数据状态提醒
  error: '#DE350B',        // 红色 - 错误和不可用状态
  info: '#0065FF',         // 信息蓝

  // 中性色系 - 偏冷色调
  textPrimary: '#172B4D',     // 深蓝灰 - 主要文本
  textSecondary: '#5E6C84',   // 蓝灰 - 次要文本
  textTertiary: '#8993A4',    // 浅蓝灰 - 辅助文本
  borderLight: '#DFE1E6',     // 浅灰蓝 - 边框
  backgroundLight: '#F4F5F7', // 极浅蓝灰 - 背景
  backgroundDark: '#091E42',  // 深蓝黑 - 深色背景

  // 状态色语义化
  statusAvailable: '#00875A',    // 可用(深绿色)
  statusMaintenance: '#FF991F',  // 维护中(橙色)
  statusOffline: '#6B778C',      // 已下线(灰蓝色)
  statusInProgress: '#0052CC',   // 进行中(专业蓝)
  statusNeedAction: '#5243AA',   // 需处理(深紫蓝)
};

// Ant Design主题配置
export const antdTheme: ThemeConfig = {
  token: {
    // 主色调配置
    colorPrimary: themeColors.primary,
    colorSuccess: themeColors.success,
    colorWarning: themeColors.warning,
    colorError: themeColors.error,
    colorInfo: themeColors.primary,

    // 文字颜色
    colorText: themeColors.textPrimary,
    colorTextSecondary: themeColors.textSecondary,
    colorTextTertiary: themeColors.textTertiary,

    // 边框颜色
    colorBorder: themeColors.borderLight,
    colorBorderSecondary: '#e8e8e8',

    // 背景色 - 专业蓝调
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBgLayout: themeColors.backgroundLight,

    // 圆角
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 4,

    // 字体设置
    fontSize: 14,
    fontSizeLG: 16,
    fontSizeXL: 20,
    fontSizeHeading1: 38,
    fontSizeHeading2: 30,
    fontSizeHeading3: 24,
    fontSizeHeading4: 20,
    fontSizeHeading5: 16,

    // 间距系统 (8px基础单位)
    margin: 16,
    marginLG: 24,
    marginXL: 32,
    marginXS: 8,
    marginXXS: 4,

    padding: 16,
    paddingLG: 24,
    paddingXL: 32,
    paddingXS: 8,
    paddingXXS: 4,

    // 阴影层次
    boxShadowSecondary: '0 2px 8px rgba(0,0,0,0.06)',
    boxShadowTertiary: '0 4px 12px rgba(0,0,0,0.08)',

    // 动画
    motionDurationSlow: '0.3s',
    motionDurationMid: '0.2s',
    motionDurationFast: '0.1s',
  },

  components: {
    // 按钮定制
    Button: {
      borderRadius: 8,
      controlHeight: 40,
      controlHeightLG: 48,
      controlHeightSM: 32,
      fontSize: 14,
      fontWeight: 500,
      paddingContentHorizontal: 16,
    },

    // 卡片定制
    Card: {
      borderRadiusLG: 12,
      paddingLG: 24,
      boxShadowTertiary: '0 2px 8px rgba(0,0,0,0.06)',
    },

    // 输入框定制
    Input: {
      borderRadius: 8,
      controlHeight: 40,
      controlHeightLG: 48,
      fontSize: 14,
      paddingInline: 16,
    },

    // 表格定制
    Table: {
      borderRadiusLG: 8,
      cellPaddingBlock: 16,
      cellPaddingInline: 16,
      headerBg: '#fafafa',
      headerColor: themeColors.textPrimary,
      headerSortActiveBg: '#f0f0f0',
    },

    // 菜单定制
    Menu: {
      itemBorderRadius: 8,
      itemHeight: 48,
      itemPaddingInline: 16,
      fontSize: 14,
      fontWeight: 500,
    },

    // 表单定制
    Form: {
      labelFontSize: 14,
      labelHeight: 32,
      verticalLabelPadding: '0 0 8px',
    },

    // 模态框定制
    Modal: {
      borderRadiusLG: 12,
      paddingLG: 24,
      titleFontSize: 18,
      titleLineHeight: 1.5,
    },

    // 通知定制
    Message: {
      borderRadius: 8,
      fontSize: 14,
      paddingInline: 16,
    },

    // 标签定制
    Tag: {
      borderRadiusSM: 4,
      paddingInline: 8,
      fontSize: 12,
      fontWeight: 500,
    },

    // 分页定制
    Pagination: {
      itemSize: 40,
      itemSizeSM: 32,
      borderRadius: 8,
    }
  },

  // 算法配置
  algorithm: [],
};

// 专门针对数据洞察的主题扩展
export const insightTheme = {
  ...antdTheme,
  token: {
    ...antdTheme.token,
    colorPrimary: themeColors.insight, // 使用洞察紫作为主色
  }
};

// CSS变量导出（用于自定义组件） - 专业蓝调
export const cssVariables = {
  '--primary-color': themeColors.primary,
  '--primary-light': themeColors.primaryLight,
  '--primary-dark': themeColors.primaryDark,
  '--secondary-color': themeColors.secondary,
  '--accent-color': themeColors.accent,
  '--insight-color': themeColors.insight,
  '--success-color': themeColors.success,
  '--warning-color': themeColors.warning,
  '--error-color': themeColors.error,
  '--info-color': themeColors.info,
  '--text-primary': themeColors.textPrimary,
  '--text-secondary': themeColors.textSecondary,
  '--text-tertiary': themeColors.textTertiary,
  '--border-light': themeColors.borderLight,
  '--background-light': themeColors.backgroundLight,
  '--background-dark': themeColors.backgroundDark,
  '--status-available': themeColors.statusAvailable,
  '--status-maintenance': themeColors.statusMaintenance,
  '--status-offline': themeColors.statusOffline,
  '--status-in-progress': themeColors.statusInProgress,
  '--status-need-action': themeColors.statusNeedAction,
  '--border-radius': '8px',
  '--border-radius-lg': '12px',
  '--border-radius-sm': '4px',
  '--spacing-xs': '8px',
  '--spacing-sm': '12px',
  '--spacing-md': '16px',
  '--spacing-lg': '24px',
  '--spacing-xl': '32px',
  '--spacing-xxl': '48px',
  '--shadow-light': '0 2px 8px rgba(0,0,0,0.06)',
  '--shadow-standard': '0 4px 12px rgba(0,0,0,0.08)',
  '--shadow-deep': '0 8px 24px rgba(0,0,0,0.12)',
  '--shadow-primary': '0 4px 16px rgba(0,82,204,0.15)',
  '--shadow-insight': '0 4px 16px rgba(82,67,170,0.15)',
} as const;

export default antdTheme;