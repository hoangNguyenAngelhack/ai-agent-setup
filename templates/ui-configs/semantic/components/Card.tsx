// @ts-nocheck
import { Card as SemanticCard, CardProps as SemanticCardProps } from 'semantic-ui-react';

export interface CardProps extends SemanticCardProps {}

export function Card({ children, ...props }: CardProps) {
  return <SemanticCard {...props}>{children}</SemanticCard>;
}

Card.Content = SemanticCard.Content;
Card.Header = SemanticCard.Header;
Card.Meta = SemanticCard.Meta;
Card.Description = SemanticCard.Description;
Card.Group = SemanticCard.Group;
