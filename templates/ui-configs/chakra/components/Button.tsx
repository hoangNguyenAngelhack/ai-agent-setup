// @ts-nocheck
import { Button as ChakraButton, ButtonProps as ChakraButtonProps } from '@chakra-ui/react';

export interface ButtonProps extends ChakraButtonProps {}

export function Button({ children, ...props }: ButtonProps) {
  return <ChakraButton {...props}>{children}</ChakraButton>;
}
