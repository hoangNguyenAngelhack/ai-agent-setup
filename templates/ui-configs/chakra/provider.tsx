// @ts-nocheck
'use client';

import { ChakraProvider as ChakraBaseProvider } from '@chakra-ui/react';
import { theme } from '@/lib/chakra-theme';

interface ChakraProviderProps {
  children: React.ReactNode;
}

export function ChakraProvider({ children }: ChakraProviderProps) {
  return <ChakraBaseProvider theme={theme}>{children}</ChakraBaseProvider>;
}
