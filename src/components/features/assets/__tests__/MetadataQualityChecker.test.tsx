import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import MetadataQualityChecker from '../MetadataQualityChecker'

const mockOnImprove = jest.fn()

const completeMetadata = {
  name: '用户行为数据表',
  description: '这是一个包含用户行为数据的详细表格，用于分析用户操作模式和行为趋势，帮助业务团队做出数据驱动的决策',
  tags: '数据分析,用户行为,实时数据',
  owner: '张三',
  lastUpdated: new Date('2023-11-01'),
  documentation: ['用户手册.pdf', '数据字典.xlsx']
}

const incompleteMetadata = {
  name: '数据表',
  description: '简单描述',
  tags: '标签',
  owner: '',
  lastUpdated: undefined,
  documentation: []
}

const emptyMetadata = {
  name: '',
  description: '',
  tags: '',
  owner: '',
  lastUpdated: undefined,
  documentation: []
}

describe('MetadataQualityChecker', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('基本渲染', () => {
    it('应该正确渲染质量检查器', () => {
      render(<MetadataQualityChecker metadata={completeMetadata} />)

      expect(screen.getByText('元数据完整性检查')).toBeInTheDocument()
      expect(screen.getByText('质量评分')).toBeInTheDocument()
      expect(screen.getByText('完整度')).toBeInTheDocument()
      expect(screen.getByText('检查详情')).toBeInTheDocument()
    })

    it('应该显示评分说明', () => {
      render(<MetadataQualityChecker metadata={completeMetadata} />)

      expect(screen.getByText('评分说明：')).toBeInTheDocument()
      expect(screen.getByText(/90-100分：优秀/)).toBeInTheDocument()
      expect(screen.getByText(/70-89分：良好/)).toBeInTheDocument()
      expect(screen.getByText(/0-69分：需要改进/)).toBeInTheDocument()
    })
  })

  describe('质量评分计算', () => {
    it('应该为完整元数据给出高分', () => {
      render(<MetadataQualityChecker metadata={completeMetadata} />)

      // 寻找质量评分数字
      const scoreElements = screen.getAllByText(/^\d+$/)
      const qualityScore = scoreElements.find(el => {
        const parent = el.parentElement
        return parent?.textContent?.includes('质量评分')
      })

      expect(qualityScore).toBeTruthy()
      expect(parseInt(qualityScore?.textContent || '0')).toBeGreaterThan(85)
    })

    it('应该为不完整元数据给出低分', () => {
      render(<MetadataQualityChecker metadata={incompleteMetadata} />)

      const scoreElements = screen.getAllByText(/^\d+$/)
      const qualityScore = scoreElements.find(el => {
        const parent = el.parentElement
        return parent?.textContent?.includes('质量评分')
      })

      expect(qualityScore).toBeTruthy()
      expect(parseInt(qualityScore?.textContent || '0')).toBeLessThan(80)
    })

    it('应该为空元数据给出很低分', () => {
      render(<MetadataQualityChecker metadata={emptyMetadata} />)

      const scoreElements = screen.getAllByText(/^\d+$/)
      const qualityScore = scoreElements.find(el => {
        const parent = el.parentElement
        return parent?.textContent?.includes('质量评分')
      })

      expect(qualityScore).toBeTruthy()
      expect(parseInt(qualityScore?.textContent || '0')).toBeLessThan(50)
    })
  })

  describe('检查详情显示', () => {
    it('应该显示所有检查项目', () => {
      render(<MetadataQualityChecker metadata={completeMetadata} />)

      expect(screen.getByText('资产名称')).toBeInTheDocument()
      expect(screen.getByText('详细描述')).toBeInTheDocument()
      expect(screen.getByText('标签分类')).toBeInTheDocument()
      expect(screen.getByText('负责人信息')).toBeInTheDocument()
      expect(screen.getByText('更新时间')).toBeInTheDocument()
      expect(screen.getByText('相关文档')).toBeInTheDocument()
    })

    it('应该显示检查项目的重要性级别', () => {
      render(<MetadataQualityChecker metadata={completeMetadata} />)

      expect(screen.getByText('必需')).toBeInTheDocument() // critical
      expect(screen.getByText('重要')).toBeInTheDocument()  // important
      expect(screen.getByText('可选')).toBeInTheDocument()  // optional
    })

    it('应该显示检查项目的分数', () => {
      render(<MetadataQualityChecker metadata={completeMetadata} />)

      // 应该有多个分数显示
      const scoreTexts = screen.getAllByText(/\d+分/)
      expect(scoreTexts.length).toBeGreaterThan(0)
    })

    it('应该为完整字段显示完成状态图标', () => {
      render(<MetadataQualityChecker metadata={completeMetadata} />)

      // 检查是否有完成状态的图标（绿色对勾）
      const icons = document.querySelectorAll('svg.text-green-600')
      expect(icons.length).toBeGreaterThan(0)
    })

    it('应该为缺失字段显示错误状态图标', () => {
      render(<MetadataQualityChecker metadata={emptyMetadata} />)

      // 检查是否有错误状态的图标（红色X）
      const icons = document.querySelectorAll('svg.text-red-600')
      expect(icons.length).toBeGreaterThan(0)
    })
  })

  describe('改进建议功能', () => {
    it('应该为不完整元数据显示改进建议', () => {
      render(<MetadataQualityChecker metadata={incompleteMetadata} />)

      expect(screen.getByText('改进建议')).toBeInTheDocument()

      // 应该有具体的建议内容
      const suggestions = screen.getByText(/请/)
      expect(suggestions).toBeInTheDocument()
    })

    it('应该显示应用建议按钮', () => {
      render(<MetadataQualityChecker metadata={incompleteMetadata} onImprove={mockOnImprove} />)

      const applyButton = screen.getByText('应用建议')
      expect(applyButton).toBeInTheDocument()
    })

    it('应该调用onImprove回调', async () => {
      const user = userEvent.setup()
      render(<MetadataQualityChecker metadata={incompleteMetadata} onImprove={mockOnImprove} />)

      const applyButton = screen.getByText('应用建议')
      await user.click(applyButton)

      expect(mockOnImprove).toHaveBeenCalledWith(expect.any(Array))
    })

    it('不应该为完整元数据显示改进建议', () => {
      render(<MetadataQualityChecker metadata={completeMetadata} />)

      expect(screen.queryByText('改进建议')).not.toBeInTheDocument()
    })
  })

  describe('特定字段验证', () => {
    it('应该正确验证资产名称', () => {
      const metadataWithoutName = { ...completeMetadata, name: '' }
      render(<MetadataQualityChecker metadata={metadataWithoutName} />)

      expect(screen.getByText(/请提供资产名称/)).toBeInTheDocument()
    })

    it('应该正确验证描述长度', () => {
      const metadataWithShortDesc = { ...completeMetadata, description: '短描述' }
      render(<MetadataQualityChecker metadata={metadataWithShortDesc} />)

      expect(screen.getByText(/建议丰富资产描述内容/)).toBeInTheDocument()
    })

    it('应该正确验证标签数量', () => {
      const metadataWithFewTags = { ...completeMetadata, tags: '单个标签' }
      render(<MetadataQualityChecker metadata={metadataWithFewTags} />)

      expect(screen.getByText(/建议添加更多标签/)).toBeInTheDocument()
    })

    it('应该正确验证更新时间', () => {
      const oldDate = new Date('2020-01-01')
      const metadataWithOldDate = { ...completeMetadata, lastUpdated: oldDate }
      render(<MetadataQualityChecker metadata={metadataWithOldDate} />)

      expect(screen.getByText(/资产信息较久未更新/)).toBeInTheDocument()
    })

    it('应该正确验证文档存在', () => {
      const metadataWithoutDocs = { ...completeMetadata, documentation: [] }
      render(<MetadataQualityChecker metadata={metadataWithoutDocs} />)

      expect(screen.getByText(/建议上传相关文档/)).toBeInTheDocument()
    })
  })

  describe('完整度计算', () => {
    it('应该正确计算完整度百分比', () => {
      render(<MetadataQualityChecker metadata={completeMetadata} />)

      // 寻找完整度百分比
      const percentageElements = screen.getAllByText(/%$/)
      const completeness = percentageElements.find(el => {
        const parent = el.parentElement
        return parent?.textContent?.includes('完整度')
      })

      expect(completeness).toBeTruthy()
      expect(parseInt(completeness?.textContent?.replace('%', '') || '0')).toBeGreaterThan(80)
    })

    it('应该为不完整元数据显示较低完整度', () => {
      render(<MetadataQualityChecker metadata={incompleteMetadata} />)

      const percentageElements = screen.getAllByText(/%$/)
      const completeness = percentageElements.find(el => {
        const parent = el.parentElement
        return parent?.textContent?.includes('完整度')
      })

      expect(completeness).toBeTruthy()
      expect(parseInt(completeness?.textContent?.replace('%', '') || '0')).toBeLessThan(100)
    })
  })

  describe('样式和UI状态', () => {
    it('应该为高分显示绿色样式', () => {
      render(<MetadataQualityChecker metadata={completeMetadata} />)

      // 检查是否有绿色样式的元素
      const greenElements = document.querySelectorAll('.text-green-600, .bg-green-50, .border-green-200')
      expect(greenElements.length).toBeGreaterThan(0)
    })

    it('应该为低分显示红色样式', () => {
      render(<MetadataQualityChecker metadata={emptyMetadata} />)

      // 检查是否有红色样式的元素
      const redElements = document.querySelectorAll('.text-red-600, .bg-red-50, .border-red-200')
      expect(redElements.length).toBeGreaterThan(0)
    })

    it('应该为中等分数显示黄色样式', () => {
      render(<MetadataQualityChecker metadata={incompleteMetadata} />)

      // 检查是否有黄色样式的元素
      const yellowElements = document.querySelectorAll('.text-yellow-600, .bg-yellow-50, .border-yellow-200')
      expect(yellowElements.length).toBeGreaterThan(0)
    })
  })

  describe('自定义样式', () => {
    it('应该应用自定义className', () => {
      const customClass = 'custom-quality-checker'
      const { container } = render(
        <MetadataQualityChecker metadata={completeMetadata} className={customClass} />
      )

      expect(container.firstChild).toHaveClass(customClass)
    })
  })
})