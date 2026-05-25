// @ts-nocheck
'use client';

import { ConfigProvider } from 'antd';
import { theme } from '@/lib/antd-theme';

interface AntdProviderProps {
  children: React.ReactNode;
}

export function AntdProvider({ children }: AntdProviderProps) {
  return <ConfigProvider theme={theme}>{children}</ConfigProvider>;
}
