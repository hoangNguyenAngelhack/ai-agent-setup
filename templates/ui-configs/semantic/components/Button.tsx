// @ts-nocheck
import { Button as SemanticButton, ButtonProps as SemanticButtonProps } from 'semantic-ui-react';

export interface ButtonProps extends SemanticButtonProps {}

export function Button({ children, ...props }: ButtonProps) {
  return <SemanticButton {...props}>{children}</SemanticButton>;
}
