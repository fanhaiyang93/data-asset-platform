/**
 * 第三方平台集成相关类型定义
 */

export type RedirectMode = 'new_window' | 'current_window' | 'iframe';

export interface PlatformRedirectProps {
  applicationId: string;
  platform: string;
  mode?: RedirectMode;
  onSuccess?: (result: RedirectResult) => void;
  onError?: (error: RedirectError) => void;
  className?: string;
}

export interface RedirectResult {
  success: boolean;
  redirectUrl: string;
  platform: string;
  timestamp: number;
}

export interface RedirectError {
  code: string;
  message: string;
  platform: string;
  details?: Record<string, any>;
}

export interface PlatformInfo {
  key: string;
  name: string;
  description: string;
  icon?: string;
  supportedModes: RedirectMode[];
}

export interface RedirectConfig {
  mode: RedirectMode;
  width?: number;
  height?: number;
  features?: string[];
}

export interface MobileRedirectOptions {
  preferredMode: RedirectMode;
  fallbackMode: RedirectMode;
  showFullscreenPrompt?: boolean;
}