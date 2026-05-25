// @ts-nocheck
import { Input as AntInput, InputProps as AntInputProps } from 'antd';

export interface InputProps extends AntInputProps {}

export function Input(props: InputProps) {
  return <AntInput {...props} />;
}

Input.Password = AntInput.Password;
Input.TextArea = AntInput.TextArea;
Input.Search = AntInput.Search;
