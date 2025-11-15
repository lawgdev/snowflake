# @lawg.dev/snowflake

A TypeScript library for generating unique IDs based off [Twitter's Snowflake algorithm.](https://en.wikipedia.org/wiki/Snowflake_ID) and [Pika's node ID generation strategy.](https://github.com/Phineas/pika) (via MAC addresses)

## Why?

`nodejs-snowflake` is one of the most popular (by downloads) Snowflake implementations for Node.JS, but its implementation does not follow Twitter's original strategy for verbatim. Additionally, I like Pika's approach to using MAC addresses to ensure uniqueness across a distributed system without relying on a central authority to assign worker IDs. This library combines those two, while still giving you the ability to customize the node ID assignment strategy if you so choose.

## Installation

```bash
bun install @lawg.dev/snowflake
# or
yarn add @lawg.dev/snowflake
# or
pnpm add @lawg.dev/snowflake
```

## Usage

```typescript
import { Snowflake } from "@lawg.dev/snowflake";

const snowflake = new Snowflake({
  epoch: 1609459200000, // Custom epoch (January 1, 2021)
});

const id = snowflake.generate();
console.log(id.toString());

const decodedSnowflake = snowflake.decode(id);
console.log(decodedSnowflake); // { timestamp: 1610000000000, nodeId: 1, sequence: 0 }
```

## Performance

This package is relatively performant. All benchmarks were performed on a 2023 MacBook Pro (M3 Pro)

```
$ bun bench/throughput.bench.ts

=== throughput statistics ===
samples: 10

average: 4,097,054 ids/second
median:  4,098,166 ids/second
min:     4,087,789 ids/second
max:     4,099,521 ids/second

p95:     4,099,521 ids/second
p99:     4,099,521 ids/second

std dev: 3,257 ids/second

```

```
$ bun bench/index.bench.ts

clk: ~3.88 GHz
cpu: Apple M3 Pro
runtime: bun 1.3.1 (arm64-darwin)

benchmark                                      avg (min … max) p75 / p99    (min … top 1%)
-------------------------------------------------------------- -------------------------------
single id generation                             42.35 µs/iter  42.54 µs               █     █
                                         (41.79 µs … 42.73 µs)  42.67 µs ▅  ▅     ▅▅ ▅▅█  ▅  █
                                       (  0.00  b …  14.92 kb)   2.96 kb █▁▁█▁▁▁▁▁██▁███▁▁█▁▁█

100 ids sequential                               54.32 µs/iter  55.92 µs     █
                                        (47.50 µs … 251.21 µs)  68.54 µs     █
                                       (  0.00  b …  32.00 kb)   1.39 kb ▁▃▂▃██▃▃▃▃▂▂▃▃▃▂▁▁▁▁▁

1000 ids sequential                             154.85 µs/iter 156.54 µs       █
                                       (140.00 µs … 333.79 µs) 180.58 µs       █
                                       (  0.00  b … 144.00 kb) 544.68  b ▂▃▁▁▂██▅▃▄▅▃▂▂▂▁▁▁▁▁▁

10000 ids sequential                              2.00 ms/iter   2.00 ms                   █
                                           (1.83 ms … 2.14 ms)   2.02 ms                  ██
                                       (  0.00  b … 288.00 kb) 879.37  b ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▅██▆▂

decode single id                                 42.25 µs/iter  42.38 µs          █  █
                                         (41.52 µs … 43.01 µs)  42.90 µs ▅▅      ▅█▅▅█▅      ▅
                                       (  0.00  b …   4.00  b)   0.33  b ██▁▁▁▁▁▁██████▁▁▁▁▁▁█

generate + decode 100 times                      61.66 µs/iter  61.83 µs      █ █
                                         (61.12 µs … 62.48 µs)  62.30 µs ▅▅▅  █ █   ▅▅    ▅  ▅
                                       (  0.00  b …  20.00  b)   1.82  b ███▁▁█▁█▁▁▁██▁▁▁▁█▁▁█

multiple instances (10) generating 100 ids each 545.98 µs/iter 554.13 µs          ▄█▆▅
                                       (493.75 µs … 787.25 µs) 586.00 µs         ██████▅
                                       (  0.00  b …  64.00 kb)  63.55  b ▂▂▂▃▂▂▃▇████████▆▄▃▂▂

round-trip (generate -> decode) 1000 times      228.66 µs/iter 232.33 µs     █▂
                                       (202.08 µs … 432.71 µs) 294.88 µs     ██▄
                                       (  0.00  b …  16.00 kb)  16.04  b ▂▃▂▅████▆▄▃▂▁▁▁▁▁▁▁▁▁

throughput - ids per second                        1.00 s/iter    1.00 s  █▂
                                             (1.00 s … 1.00 s)    1.00 s ▅██
                                       (  0.00  b …  16.00 kb)   4.36 kb ███▁▁▁▁▁▁▁▁▁▁▁▁▁▇▁▁▁▇

```
