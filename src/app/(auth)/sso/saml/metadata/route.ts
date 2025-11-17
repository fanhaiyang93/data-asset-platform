/**
 * SAML元数据路由
 * 提供SP (Service Provider) 元数据供IdP使用
 */

import { NextRequest, NextResponse } from 'next/server';
import { SAMLMetadataService } from '@/lib/auth/sso/saml/samlMetadata';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/auth/sso/saml/metadata
 * 返回SAML SP元数据XML
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('providerId');

    // 1. 查找SAML提供商
    let samlProvider;

    if (providerId) {
      // 使用指定的提供商
      samlProvider = await prisma.sSOProvider.findUnique({
        where: {
          id: providerId,
          type: 'SAML'
        }
      });
    } else {
      // 使用第一个SAML提供商
      samlProvider = await prisma.sSOProvider.findFirst({
        where: {
          type: 'SAML'
        }
      });
    }

    if (!samlProvider) {
      return new NextResponse(
        'SAML provider not found',
        {
          status: 404,
          headers: {
            'Content-Type': 'text/plain'
          }
        }
      );
    }

    // 2. 生成元数据XML
    let metadataXML: string;

    if (samlProvider.id) {
      // 从数据库提供商生成
      metadataXML = await SAMLMetadataService.generateSPMetadataFromProvider(
        samlProvider.id
      );
    } else {
      // 使用默认配置生成
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      metadataXML = SAMLMetadataService.generateSPMetadata({
        entityId: samlProvider.entityId || `${baseUrl}/saml/metadata`,
        acsUrl: `${baseUrl}/api/auth/sso/saml/acs`,
        sloUrl: samlProvider.sloUrl ? `${baseUrl}/api/auth/sso/saml/slo` : undefined,
        certificate: samlProvider.certificateData || undefined,
        wantAssertionsSigned: true,
        organizationName: '数据资产管理平台',
        organizationDisplayName: '数据资产管理平台',
        organizationURL: baseUrl,
        contactPersonName: 'Administrator',
        contactPersonEmail: process.env.ADMIN_EMAIL || 'admin@example.com'
      });
    }

    // 3. 记录元数据访问日志
    await prisma.sSOLog.create({
      data: {
        providerId: samlProvider.id,
        action: 'METADATA_ACCESS',
        status: 'SUCCESS',
        message: 'SAML SP metadata accessed',
        ipAddress: request.headers.get('x-forwarded-for') ||
                  request.headers.get('x-real-ip') ||
                  'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    });

    // 4. 返回XML响应
    return new NextResponse(metadataXML, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="saml-metadata-${samlProvider.name || 'sp'}.xml"`,
        'Cache-Control': 'public, max-age=3600' // 缓存1小时
      }
    });

  } catch (error) {
    console.error('SAML metadata generation error:', error);

    // 记录错误
    try {
      const samlProvider = await prisma.sSOProvider.findFirst({
        where: { type: 'SAML' }
      });

      if (samlProvider) {
        await prisma.sSOLog.create({
          data: {
            providerId: samlProvider.id,
            action: 'METADATA_ACCESS',
            status: 'ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            errorCode: 'METADATA_ERROR',
            ipAddress: request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown'
          }
        });
      }
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new NextResponse(
      'Failed to generate SAML metadata',
      {
        status: 500,
        headers: {
          'Content-Type': 'text/plain'
        }
      }
    );
  }
}

/**
 * POST /api/auth/sso/saml/metadata
 * 上传和验证IdP元数据
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('providerId');

    if (!providerId) {
      return NextResponse.json(
        { error: 'Provider ID is required' },
        { status: 400 }
      );
    }

    // 1. 获取上传的元数据
    const contentType = request.headers.get('content-type');
    let metadataXML: string;

    if (contentType?.includes('application/xml') || contentType?.includes('text/xml')) {
      // XML直接上传
      metadataXML = await request.text();
    } else if (contentType?.includes('application/json')) {
      // JSON包装的XML
      const body = await request.json();
      metadataXML = body.metadata || body.xml;
    } else if (contentType?.includes('multipart/form-data')) {
      // 文件上传
      const formData = await request.formData();
      const file = formData.get('metadata') as File;

      if (!file) {
        return NextResponse.json(
          { error: 'No metadata file provided' },
          { status: 400 }
        );
      }

      metadataXML = await file.text();
    } else {
      return NextResponse.json(
        { error: 'Unsupported content type' },
        { status: 400 }
      );
    }

    if (!metadataXML) {
      return NextResponse.json(
        { error: 'No metadata provided' },
        { status: 400 }
      );
    }

    // 2. 验证并保存元数据
    await SAMLMetadataService.validateAndSaveIdPMetadata(
      providerId,
      metadataXML
    );

    // 3. 记录成功日志
    await prisma.sSOLog.create({
      data: {
        providerId,
        action: 'METADATA_UPLOAD',
        status: 'SUCCESS',
        message: 'IdP metadata uploaded and validated successfully',
        ipAddress: request.headers.get('x-forwarded-for') ||
                  request.headers.get('x-real-ip') ||
                  'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    });

    return NextResponse.json({
      success: true,
      message: 'IdP metadata uploaded successfully'
    });

  } catch (error) {
    console.error('IdP metadata upload error:', error);

    // 记录错误
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('providerId');

    if (providerId) {
      try {
        await prisma.sSOLog.create({
          data: {
            providerId,
            action: 'METADATA_UPLOAD',
            status: 'ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            errorCode: 'METADATA_UPLOAD_ERROR',
            ipAddress: request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown'
          }
        });
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload metadata'
      },
      { status: 500 }
    );
  }
}
