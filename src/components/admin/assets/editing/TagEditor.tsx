/**
 * 标签编辑器组件
 * Story 5.3: 资产编辑与维护
 *
 * 支持标签和关键词的管理功能:
 * - 添加/删除标签
 * - 标签搜索和自动完成
 * - 热门标签推荐
 * - 最近使用标签
 */

'use client'

import React, { useState, useEffect, useRef } from 'react'
import { TagManagement } from '@/types/assetMaintenance'

interface TagEditorProps {
  assetId: string
  currentTags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  maxTags?: number
  className?: string
}

export function TagEditor({
  assetId,
  currentTags,
  onChange,
  placeholder = '输入标签...',
  maxTags = 20,
  className = ''
}: TagEditorProps) {
  const [tags, setTags] = useState<string[]>(currentTags)
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [popularTags, setPopularTags] = useState<string[]>([])
  const [recentTags, setRecentTags] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // 加载标签建议
  useEffect(() => {
    loadTagSuggestions()
  }, [assetId])

  // 同步外部tags变更
  useEffect(() => {
    setTags(currentTags)
  }, [currentTags])

  const loadTagSuggestions = async () => {
    try {
      // TODO: 实际实现需要调用API
      // 模拟数据
      setPopularTags(['数据仓库', '用户行为', '实时数据', '业务报表'])
      setRecentTags(['交易数据', '客户信息', '订单记录'])
    } catch (error) {
      console.error('Error loading tag suggestions:', error)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)

    // 搜索标签建议
    if (value.trim()) {
      const filtered = [...popularTags, ...recentTags]
        .filter(tag => tag.toLowerCase().includes(value.toLowerCase()))
        .filter(tag => !tags.includes(tag))
        .slice(0, 5)
      setSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim()
    if (!trimmedTag) return
    if (tags.includes(trimmedTag)) return
    if (tags.length >= maxTags) {
      alert(`最多只能添加 ${maxTags} 个标签`)
      return
    }

    const newTags = [...tags, trimmedTag]
    setTags(newTags)
    onChange(newTags)
    setInputValue('')
    setSuggestions([])
    setShowSuggestions(false)
  }

  const removeTag = (tagToRemove: string) => {
    const newTags = tags.filter(tag => tag !== tagToRemove)
    setTags(newTags)
    onChange(newTags)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (showSuggestions && suggestions.length > 0) {
        addTag(suggestions[0])
      } else if (inputValue.trim()) {
        addTag(inputValue)
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  const handleSuggestionClick = (tag: string) => {
    addTag(tag)
    inputRef.current?.focus()
  }

  return (
    <div className={`tag-editor ${className}`}>
      <div className="tag-input-container border border-gray-300 rounded-lg p-2 focus-within:ring-2 focus-within:ring-blue-500">
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-2 text-blue-600 hover:text-blue-800 focus:outline-none"
                aria-label={`删除标签 ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true)
            }
          }}
          onBlur={() => {
            // 延迟隐藏建议,以便点击建议项
            setTimeout(() => setShowSuggestions(false), 200)
          }}
          placeholder={tags.length < maxTags ? placeholder : `已达到标签上限 (${maxTags})`}
          disabled={tags.length >= maxTags}
          className="w-full outline-none bg-transparent"
        />

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {suggestions.map((tag, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSuggestionClick(tag)}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {popularTags.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">热门标签</h4>
            <div className="flex flex-wrap gap-2">
              {popularTags
                .filter(tag => !tags.includes(tag))
                .map((tag, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => addTag(tag)}
                    disabled={tags.length >= maxTags}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-full hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    + {tag}
                  </button>
                ))}
            </div>
          </div>
        )}

        {recentTags.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">最近使用</h4>
            <div className="flex flex-wrap gap-2">
              {recentTags
                .filter(tag => !tags.includes(tag))
                .map((tag, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => addTag(tag)}
                    disabled={tags.length >= maxTags}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-full hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    + {tag}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 text-xs text-gray-500">
        已添加 {tags.length} / {maxTags} 个标签
      </div>
    </div>
  )
}

export default TagEditor
