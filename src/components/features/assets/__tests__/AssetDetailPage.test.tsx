import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AssetDetailPage } from '../AssetDetailPage'
import { type AssetDetail, type SampleDataResult } from '@/server/services/AssetService'

// Mock the child components
jest.mock('../TableSchemaDisplay', () => ({
  TableSchemaDisplay: ({ columns }: any) => (
    <div data-testid="table-schema-display">
      表结构 - {columns.length} 个字段
    </div>
  )
}))

jest.mock('../SampleDataTable', () => ({
  SampleDataTable: ({ data }: any) => (
    <div data-testid="sample-data-table">
      数据样例 - {data.rows.length} 行
    </div>
  )
}))

jest.mock('../AssetMetadataPanel', () => ({
  AssetMetadataPanel: ({ asset }: any) => (
    <div data-testid="asset-metadata-panel">
      元数据面板 - {asset.name}
    </div>
  )
}))

jest.mock('../ApplyButton', () => ({
  ApplyButton: ({ asset }: any) => (
    <div data-testid="apply-button">
      申请按钮 - {asset.status}
    </div>
  )
}))

describe('AssetDetailPage', () => {
  const mockAsset: AssetDetail = {
    id: '1',
    name: '测试资产',
    code: 'TEST_ASSET_001',
    description: '这是一个测试资产',
    status: 'AVAILABLE',
    type: 'TABLE',
    format: 'PARQUET',
    size: BigInt(1024000),
    recordCount: BigInt(50000),
    categoryId: 'cat1',
    qualityScore: 85,
    accessCount: 100,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-15'),
    lastAccessed: new Date('2023-01-20'),
    category: {
      id: 'cat1',
      name: '测试分类',
      code: 'TEST_CAT'
    },
    creator: {
      id: 'user1',
      username: 'testuser',
      name: '测试用户',
      email: 'test@example.com'
    },
    updater: {
      id: 'user2',
      username: 'updater',
      name: '更新用户',
      email: 'updater@example.com'
    },
    metadataVersions: [],
    usageStats: {
      applicationCount: 10,
      activeUsers: 5,
      lastAccessed: new Date('2023-01-20')
    },
    tableSchema: {
      columns: [
        {
          name: 'id',
          type: 'bigint',
          nullable: false,
          comment: '主键ID',
          isPrimaryKey: true,
          isForeignKey: false
        },
        {
          name: 'name',
          type: 'varchar(255)',
          nullable: false,
          comment: '名称',
          isPrimaryKey: false,
          isForeignKey: false
        }
      ],
      indexes: ['PRIMARY KEY (id)'],
      constraints: ['NOT NULL (id, name)']
    }
  }

  const mockSampleData: SampleDataResult = {
    columns: ['id', 'name', 'email'],
    rows: [
      [1, 'John Doe', 'john@example.com'],
      [2, 'Jane Smith', 'jane@example.com']
    ],
    totalRows: 1000,
    isMasked: true,
    processingTime: 150
  }

  const defaultProps = {
    asset: mockAsset,
    sampleData: mockSampleData,
    onBack: jest.fn(),
    onRefreshSampleData: jest.fn(),
    onApply: jest.fn(),
    onContactOwner: jest.fn(),
    onContactTechnical: jest.fn(),
    isLoadingSampleData: false
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('渲染资产详情页面基本信息', () => {
    render(<AssetDetailPage {...defaultProps} />)

    expect(screen.getByText('测试资产')).toBeInTheDocument()
    expect(screen.getByText('TEST_ASSET_001')).toBeInTheDocument()
    expect(screen.getByText('可用')).toBeInTheDocument()
    expect(screen.getByText('测试分类')).toBeInTheDocument()
  })

  it('显示资产描述', () => {
    render(<AssetDetailPage {...defaultProps} />)

    expect(screen.getByText('这是一个测试资产')).toBeInTheDocument()
  })

  it('显示快速统计信息', () => {
    render(<AssetDetailPage {...defaultProps} />)

    expect(screen.getByText('50,000')).toBeInTheDocument() // recordCount
    expect(screen.getByText('100')).toBeInTheDocument() // accessCount
    expect(screen.getByText('85/100')).toBeInTheDocument() // qualityScore
  })

  it('正确渲染标签页', () => {
    render(<AssetDetailPage {...defaultProps} />)

    expect(screen.getByText('概览')).toBeInTheDocument()
    expect(screen.getByText('表结构')).toBeInTheDocument()
    expect(screen.getByText('数据样例')).toBeInTheDocument()
    expect(screen.getByText('设置')).toBeInTheDocument()
  })

  it('可以切换到表结构标签页', async () => {
    render(<AssetDetailPage {...defaultProps} />)

    const schemaTab = screen.getByText('表结构')
    fireEvent.click(schemaTab)

    await waitFor(() => {
      expect(screen.getByTestId('table-schema-display')).toBeInTheDocument()
    })
  })

  it('可以切换到数据样例标签页', async () => {
    render(<AssetDetailPage {...defaultProps} />)

    const sampleTab = screen.getByText('数据样例')
    fireEvent.click(sampleTab)

    await waitFor(() => {
      expect(screen.getByTestId('sample-data-table')).toBeInTheDocument()
    })
  })

  it('显示右侧边栏组件', () => {
    render(<AssetDetailPage {...defaultProps} />)

    expect(screen.getByTestId('apply-button')).toBeInTheDocument()
    expect(screen.getByTestId('asset-metadata-panel')).toBeInTheDocument()
  })

  it('处理返回按钮点击', () => {
    const onBack = jest.fn()
    render(<AssetDetailPage {...defaultProps} onBack={onBack} />)

    const backButton = screen.getByText('返回')
    fireEvent.click(backButton)

    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('当没有表结构时显示占位内容', () => {
    const assetWithoutSchema = { ...mockAsset, tableSchema: undefined }
    render(<AssetDetailPage {...defaultProps} asset={assetWithoutSchema} />)

    const schemaTab = screen.getByText('表结构')
    fireEvent.click(schemaTab)

    expect(screen.getByText('暂无表结构信息')).toBeInTheDocument()
  })

  it('当没有数据样例时显示占位内容', () => {
    render(<AssetDetailPage {...defaultProps} sampleData={undefined} />)

    const sampleTab = screen.getByText('数据样例')
    fireEvent.click(sampleTab)

    expect(screen.getByText('暂无数据样例')).toBeInTheDocument()
  })

  it('显示表结构概览统计', () => {
    render(<AssetDetailPage {...defaultProps} />)

    // 检查表结构概览中的统计信息
    expect(screen.getByText('2')).toBeInTheDocument() // 字段数
    expect(screen.getByText('1')).toBeInTheDocument() // 主键数
  })

  it('显示数据样例预览', () => {
    render(<AssetDetailPage {...defaultProps} />)

    // 数据样例预览应该显示列名
    expect(screen.getByText('id')).toBeInTheDocument()
    expect(screen.getByText('name')).toBeInTheDocument()
    expect(screen.getByText('email')).toBeInTheDocument()
  })
})