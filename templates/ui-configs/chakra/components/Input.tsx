// @ts-nocheck
import { Input as ChakraInput, InputProps as ChakraInputProps } from '@chakra-ui/react';

export interface InputProps extends ChakraInputProps {}

export function Input(props: InputProps) {
  return <ChakraInput {...props} />;
}
