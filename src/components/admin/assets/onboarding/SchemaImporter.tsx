'use client';

import React, { useState, useCallback, useRef } from 'react';
import { AssetSchema, ImportResult, ImportOptions, AssetField, FieldDataType } from '@/types/assetOnboarding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Upload,
  FileText,
  Database,
  Download,
  CheckCircle,
  AlertCircle,
  X,
  Eye,
  Settings,
  FileSpreadsheet,
  Code,
  RefreshCw
} from 'lucide-react';

interface SchemaImporterProps {
  onImport: (schema: AssetSchema) => void;
  onCancel?: () => void;
}

const SUPPORTED_FILE_TYPES = [
  {
    type: 'excel',
    label: 'Excel 文件',
    extensions: ['.xlsx', '.xls'],
    icon: FileSpreadsheet,
    description: '支持标准表结构定义格式'
  },
  {
    type: 'csv',
    label: 'CSV 文件',
    extensions: ['.csv'],
    icon: FileText,
    description: '逗号分隔的字段定义文件'
  },
  {
    type: 'json',
    label: 'JSON 文件',
    extensions: ['.json'],
    icon: Code,
    description: '结构化的JSON字段定义'
  },
  {
    type: 'sql',
    label: 'SQL DDL',
    extensions: ['.sql'],
    icon: Database,
    description: 'CREATE TABLE 语句'
  }
];

const SAMPLE_TEMPLATES = {
  excel: {
    name: 'excel_template.xlsx',
    description: 'Excel 导入模板，包含字段名、类型、描述等列'
  },
  csv: {
    name: 'csv_template.csv',
    description: 'CSV 导入模板，包含标准字段定义格式'
  },
  json: {
    name: 'json_template.json',
    description: 'JSON 导入模板，包含完整的字段结构定义'
  },
  sql: {
    name: 'sql_template.sql',
    description: 'SQL DDL 模板，标准的 CREATE TABLE 语句'
  }
};

export default function SchemaImporter({ onImport, onCancel }: SchemaImporterProps) {
  const [step, setStep] = useState<'upload' | 'options' | 'preview' | 'result'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    fileType: 'excel',
    hasHeader: true,
    delimiter: ',',
    encoding: 'utf-8',
    mapping: []
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理文件选择
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 检查文件类型
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    const supportedType = SUPPORTED_FILE_TYPES.find(type =>
      type.extensions.includes(extension)
    );

    if (!supportedType) {
      alert('不支持的文件类型，请选择支持的格式文件');
      return;
    }

    setSelectedFile(file);
    setFileType(supportedType.type);
    setImportOptions(prev => ({ ...prev, fileType: supportedType.type as any }));
    setStep('options');
  }, []);

  // 拖拽上传
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      setSelectedFile(file);

      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      const supportedType = SUPPORTED_FILE_TYPES.find(type =>
        type.extensions.includes(extension)
      );

      if (supportedType) {
        setFileType(supportedType.type);
        setImportOptions(prev => ({ ...prev, fileType: supportedType.type as any }));
        setStep('options');
      } else {
        alert('不支持的文件类型');
      }
    }
  }, []);

  // 开始导入
  const handleStartImport = useCallback(async () => {
    if (!selectedFile) return;

    setImporting(true);
    setImportProgress(0);
    setStep('preview');

    try {
      // 模拟导入过程
      const progressInterval = setInterval(() => {
        setImportProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // 模拟文件解析
      await new Promise(resolve => setTimeout(resolve, 2000));

      clearInterval(progressInterval);
      setImportProgress(100);

      // 模拟导入结果
      const mockResult: ImportResult = {
        success: true,
        totalRecords: 15,
        successRecords: 13,
        failedRecords: 2,
        errors: [
          {
            row: 5,
            field: 'type',
            message: '不支持的数据类型: varchar2',
            rawValue: 'varchar2'
          },
          {
            row: 9,
            field: 'name',
            message: '字段名包含特殊字符',
            rawValue: 'user-id'
          }
        ],
        warnings: [
          {
            row: 3,
            field: 'length',
            message: '建议为字符串类型指定长度',
            suggestion: '添加长度限制以优化存储空间'
          },
          {
            row: 7,
            field: 'description',
            message: '字段描述为空',
            suggestion: '添加描述有助于理解字段含义'
          }
        ],
        previewData: [
          {
            id: '1',
            name: 'id',
            type: FieldDataType.STRING,
            description: '主键标识',
            nullable: false,
            primaryKey: true,
            length: 32
          },
          {
            id: '2',
            name: 'user_name',
            type: FieldDataType.STRING,
            description: '用户名称',
            nullable: false,
            primaryKey: false,
            length: 100
          },
          {
            id: '3',
            name: 'email',
            type: FieldDataType.STRING,
            description: '邮箱地址',
            nullable: true,
            primaryKey: false,
            length: 200
          },
          {
            id: '4',
            name: 'age',
            type: FieldDataType.INTEGER,
            description: '年龄',
            nullable: true,
            primaryKey: false
          },
          {
            id: '5',
            name: 'balance',
            type: FieldDataType.DECIMAL,
            description: '账户余额',
            nullable: true,
            primaryKey: false,
            precision: 10,
            scale: 2
          },
          {
            id: '6',
            name: 'is_active',
            type: FieldDataType.BOOLEAN,
            description: '是否激活',
            nullable: false,
            primaryKey: false,
            defaultValue: 'true'
          },
          {
            id: '7',
            name: 'created_at',
            type: FieldDataType.TIMESTAMP,
            description: '创建时间',
            nullable: false,
            primaryKey: false
          },
          {
            id: '8',
            name: 'profile_data',
            type: FieldDataType.JSON,
            description: '扩展信息',
            nullable: true,
            primaryKey: false
          }
        ]
      };

      setImportResult(mockResult);
      setStep('result');
    } catch (error) {
      console.error('导入失败:', error);
      alert('导入失败，请重试');
    } finally {
      setImporting(false);
    }
  }, [selectedFile, importOptions]);

  // 确认导入
  const handleConfirmImport = useCallback(() => {
    if (!importResult?.previewData) return;

    const schema: AssetSchema = {
      tableName: selectedFile?.name.replace(/\.[^/.]+$/, '') || 'imported_table',
      fields: importResult.previewData
    };

    onImport(schema);
  }, [importResult, selectedFile, onImport]);

  // 下载模板
  const downloadTemplate = useCallback((type: string) => {
    const template = SAMPLE_TEMPLATES[type as keyof typeof SAMPLE_TEMPLATES];
    if (template) {
      // 模拟下载
      const link = document.createElement('a');
      link.href = '#';
      link.download = template.name;
      link.click();
      alert(`模板 ${template.name} 下载已开始`);
    }
  }, []);

  // 重新开始
  const handleRestart = useCallback(() => {
    setStep('upload');
    setSelectedFile(null);
    setFileType('');
    setImportResult(null);
    setImportProgress(0);
    setImporting(false);
  }, []);

  // 渲染上传步骤
  const renderUploadStep = () => (
    <div className="space-y-6">
      {/* 文件上传区域 */}
      <Card>
        <CardContent className="p-6">
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">上传表结构文件</h3>
            <p className="text-gray-600 mb-4">
              拖拽文件到此处，或点击选择文件
            </p>
            <Button onClick={() => fileInputRef.current?.click()}>
              选择文件
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv,.json,.sql"
              onChange={handleFileSelect}
            />
          </div>
        </CardContent>
      </Card>

      {/* 支持的文件格式 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">支持的文件格式</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SUPPORTED_FILE_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <div key={type.type} className="flex items-start space-x-3 p-3 border rounded-lg">
                  <Icon className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h4 className="font-medium">{type.label}</h4>
                    <p className="text-sm text-gray-600 mb-2">{type.description}</p>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        {type.extensions.join(', ')}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadTemplate(type.type)}
                        className="text-xs"
                      >
                        <Download className="w-3 h-3 mr-1" />
                        下载模板
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 导入说明 */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-sm text-blue-800 flex items-center">
            <Settings className="w-4 h-4 mr-2" />
            导入说明
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-700 space-y-2">
          <ul className="list-disc list-inside space-y-1">
            <li>推荐使用提供的模板格式，确保导入成功率</li>
            <li>Excel/CSV 文件需要包含：字段名、数据类型、描述、是否可空等列</li>
            <li>JSON 文件需要符合标准的字段定义结构</li>
            <li>SQL DDL 文件支持标准的 CREATE TABLE 语句</li>
            <li>导入过程中会自动验证和转换字段类型</li>
            <li>支持的最大文件大小：10MB</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );

  // 渲染配置步骤
  const renderOptionsStep = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="w-5 h-5 mr-2" />
            导入配置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 文件信息 */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center space-x-3">
              <FileText className="w-8 h-8 text-blue-600" />
              <div>
                <h4 className="font-medium">{selectedFile?.name}</h4>
                <p className="text-sm text-gray-600">
                  {selectedFile?.size ? `${(selectedFile.size / 1024).toFixed(1)} KB` : ''} •
                  {SUPPORTED_FILE_TYPES.find(t => t.type === fileType)?.label}
                </p>
              </div>
            </div>
          </div>

          {/* 配置选项 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(fileType === 'csv' || fileType === 'excel') && (
              <>
                <div className="space-y-2">
                  <Label>是否包含表头</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={importOptions.hasHeader}
                      onCheckedChange={(checked) =>
                        setImportOptions(prev => ({ ...prev, hasHeader: !!checked }))
                      }
                    />
                    <span className="text-sm">第一行为字段名</span>
                  </div>
                </div>

                {fileType === 'csv' && (
                  <div className="space-y-2">
                    <Label>分隔符</Label>
                    <Select
                      value={importOptions.delimiter}
                      onValueChange={(value) =>
                        setImportOptions(prev => ({ ...prev, delimiter: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value=",">逗号 (,)</SelectItem>
                        <SelectItem value=";">分号 (;)</SelectItem>
                        <SelectItem value="\t">制表符</SelectItem>
                        <SelectItem value="|">竖线 (|)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label>文件编码</Label>
              <Select
                value={importOptions.encoding}
                onValueChange={(value) =>
                  setImportOptions(prev => ({ ...prev, encoding: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="utf-8">UTF-8</SelectItem>
                  <SelectItem value="gbk">GBK</SelectItem>
                  <SelectItem value="gb2312">GB2312</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep('upload')}>
              重新选择文件
            </Button>
            <Button onClick={handleStartImport}>
              开始导入
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // 渲染预览步骤
  const renderPreviewStep = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <RefreshCw className={`w-5 h-5 mr-2 ${importing ? 'animate-spin' : ''}`} />
            导入进度
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={importProgress} className="w-full" />
            <div className="flex justify-between text-sm text-gray-600">
              <span>正在解析文件...</span>
              <span>{importProgress}%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // 渲染结果步骤
  const renderResultStep = () => {
    if (!importResult) return null;

    return (
      <div className="space-y-6">
        {/* 导入结果概览 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              {importResult.success ? (
                <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 mr-2 text-red-600" />
              )}
              导入结果
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {importResult.totalRecords}
                </div>
                <div className="text-sm text-gray-500">总记录数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {importResult.successRecords}
                </div>
                <div className="text-sm text-gray-500">成功导入</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {importResult.failedRecords}
                </div>
                <div className="text-sm text-gray-500">导入失败</div>
              </div>
            </div>

            {/* 错误信息 */}
            {importResult.errors.length > 0 && (
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-2">发现 {importResult.errors.length} 个错误：</div>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {importResult.errors.map((error, index) => (
                      <li key={index}>
                        第 {error.row} 行 - {error.field}: {error.message}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* 警告信息 */}
            {importResult.warnings.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-2">发现 {importResult.warnings.length} 个警告：</div>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {importResult.warnings.map((warning, index) => (
                      <li key={index}>
                        第 {warning.row} 行 - {warning.field}: {warning.message}
                        {warning.suggestion && (
                          <div className="text-blue-600 ml-4">💡 {warning.suggestion}</div>
                        )}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* 字段预览 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Eye className="w-5 h-5 mr-2" />
              字段预览 ({importResult.previewData?.length || 0} 个字段)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">字段名</th>
                    <th className="px-3 py-2 text-left">类型</th>
                    <th className="px-3 py-2 text-left">描述</th>
                    <th className="px-3 py-2 text-left">属性</th>
                  </tr>
                </thead>
                <tbody>
                  {importResult.previewData?.map((field, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-3 py-2 font-mono">{field.name}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">{field.type}</Badge>
                      </td>
                      <td className="px-3 py-2">{field.description || '-'}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {field.primaryKey && (
                            <Badge variant="default" className="text-xs">PK</Badge>
                          )}
                          {field.nullable && (
                            <Badge variant="secondary" className="text-xs">NULL</Badge>
                          )}
                          {field.length && (
                            <Badge variant="outline" className="text-xs">
                              {field.length}
                            </Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 操作按钮 */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={handleRestart}>
            重新导入
          </Button>
          <div className="space-x-2">
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                取消
              </Button>
            )}
            <Button
              onClick={handleConfirmImport}
              disabled={importResult.failedRecords > 0}
            >
              确认使用此结构
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 步骤指示器 */}
      <div className="flex items-center justify-center space-x-4 mb-8">
        {[
          { key: 'upload', label: '上传文件' },
          { key: 'options', label: '配置选项' },
          { key: 'preview', label: '导入预览' },
          { key: 'result', label: '导入结果' }
        ].map((stepItem, index) => (
          <div key={stepItem.key} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium ${
                step === stepItem.key
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : index < ['upload', 'options', 'preview', 'result'].indexOf(step)
                  ? 'border-green-600 bg-green-600 text-white'
                  : 'border-gray-300 text-gray-300'
              }`}
            >
              {index < ['upload', 'options', 'preview', 'result'].indexOf(step) ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                index + 1
              )}
            </div>
            <span
              className={`ml-2 text-sm ${
                step === stepItem.key ? 'text-blue-600 font-medium' : 'text-gray-500'
              }`}
            >
              {stepItem.label}
            </span>
            {index < 3 && (
              <div
                className={`w-12 h-0.5 mx-4 ${
                  index < ['upload', 'options', 'preview', 'result'].indexOf(step)
                    ? 'bg-green-600'
                    : 'bg-gray-300'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* 步骤内容 */}
      {step === 'upload' && renderUploadStep()}
      {step === 'options' && renderOptionsStep()}
      {step === 'preview' && renderPreviewStep()}
      {step === 'result' && renderResultStep()}
    </div>
  );
}