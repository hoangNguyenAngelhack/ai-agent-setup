// @ts-nocheck
import { Button as AntButton, ButtonProps as AntButtonProps } from 'antd';

export interface ButtonProps extends AntButtonProps {}

export function Button({ children, ...props }: ButtonProps) {
  return <AntButton {...props}>{children}</AntButton>;
}
