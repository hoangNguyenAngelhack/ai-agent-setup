// @ts-nocheck
import {
  Card as ChakraCard,
  CardHeader,
  CardBody,
  CardFooter,
  CardProps as ChakraCardProps,
} from '@chakra-ui/react';

export interface CardProps extends ChakraCardProps {}

export function Card({ children, ...props }: CardProps) {
  return <ChakraCard {...props}>{children}</ChakraCard>;
}

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;
