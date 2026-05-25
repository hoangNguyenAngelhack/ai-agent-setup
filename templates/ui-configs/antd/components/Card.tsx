// @ts-nocheck
import { Card as AntCard, CardProps as AntCardProps } from 'antd';

export interface CardProps extends AntCardProps {}

export function Card({ children, ...props }: CardProps) {
  return <AntCard {...props}>{children}</AntCard>;
}

Card.Meta = AntCard.Meta;
Card.Grid = AntCard.Grid;
