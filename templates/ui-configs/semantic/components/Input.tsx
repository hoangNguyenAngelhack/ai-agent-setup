// @ts-nocheck
import { Input as SemanticInput, InputProps as SemanticInputProps } from 'semantic-ui-react';

export interface InputProps extends SemanticInputProps {}

export function Input(props: InputProps) {
  return <SemanticInput {...props} />;
}
