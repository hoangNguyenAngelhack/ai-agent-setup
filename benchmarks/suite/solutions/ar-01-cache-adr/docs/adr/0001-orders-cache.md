# ADR 0001: Cache for GET /orders

## Status
Proposed

## Context
GET /orders is read often; the service runs as one process today.

## Options
- In-memory cache: no new dependency, fastest; lost on restart, not shared between instances.
- Redis: shared between instances, survives restarts; one more service to run, network latency.

## Decision
Start with an in-memory cache with a short TTL; move to Redis when a second instance is added.

## Consequences
Invalidate the cache when an order changes; review when scaling out.
