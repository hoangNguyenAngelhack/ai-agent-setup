# ADR 0002: Sending order emails

## Status
Proposed

## Context
Sending email inside a request adds seconds of latency and fails the request when the provider is down.

## Options
- BullMQ on Redis: simple, retries and delays built in; ordering not guaranteed.
- RabbitMQ: durable queues and routing for several services; one more broker to operate.

## Decision
Use BullMQ with three retries and exponential backoff; revisit RabbitMQ if more services consume order events.

## Consequences
Emails are sent asynchronously; failed jobs go to a dead-letter queue that is monitored.
