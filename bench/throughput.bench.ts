import { Snowflake } from "../index";

const TEST_EPOCH = 1609459200000;
const NUM_SAMPLES = 10;

console.log(`collecting ${NUM_SAMPLES} samples...\n`);

const samples: number[] = [];

for (let i = 0; i < NUM_SAMPLES; i++) {
  const snowflake = new Snowflake(TEST_EPOCH, 1);
  const startTime = performance.now();
  const endTime = startTime + 1000;
  let count = 0;

  while (performance.now() < endTime) {
    snowflake.generate();
    count++;
  }

  samples.push(count);
  process.stdout.write(`\rprogress: ${i + 1}/${NUM_SAMPLES}`);
}

console.log("\n");

const sorted = [...samples].sort((a, b) => a - b);
const sum = samples.reduce((a, b) => a + b, 0);
const avg = sum / samples.length;
const min = sorted[0];
const max = sorted[sorted.length - 1];
const median = sorted[Math.floor(sorted.length / 2)];
const p95 = sorted[Math.floor(sorted.length * 0.95)];
const p99 = sorted[Math.floor(sorted.length * 0.99)];

const variance =
  samples.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) /
  samples.length;
const stdDev = Math.sqrt(variance);

console.log("=== throughput statistics ===");
console.log(`samples: ${NUM_SAMPLES}`);
console.log(
  `\naverage: ${avg.toLocaleString(undefined, { maximumFractionDigits: 0 })} ids/second`,
);
console.log(`median:  ${median!.toLocaleString()} ids/second`);
console.log(`min:     ${min!.toLocaleString()} ids/second`);
console.log(`max:     ${max!.toLocaleString()} ids/second`);
console.log(`\np95:     ${p95!.toLocaleString()} ids/second`);
console.log(`p99:     ${p99!.toLocaleString()} ids/second`);
console.log(
  `\nstd dev: ${stdDev.toLocaleString(undefined, { maximumFractionDigits: 0 })} ids/second`,
);
console.log(
  `variance: ${variance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
);
