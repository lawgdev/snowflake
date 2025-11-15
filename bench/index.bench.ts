import { bench, run } from "mitata";
import { Snowflake } from "../index";

const TEST_EPOCH = 1609459200000; // January 1, 2021

bench("single id generation", () => {
  const snowflake = new Snowflake(TEST_EPOCH, 1);
  snowflake.generate();
});

bench("100 ids sequential", () => {
  const snowflake = new Snowflake(TEST_EPOCH, 1);
  for (let i = 0; i < 100; i++) {
    snowflake.generate();
  }
});

bench("1000 ids sequential", () => {
  const snowflake = new Snowflake(TEST_EPOCH, 1);
  for (let i = 0; i < 1000; i++) {
    snowflake.generate();
  }
});

bench("10000 ids sequential", () => {
  const snowflake = new Snowflake(TEST_EPOCH, 1);
  for (let i = 0; i < 10000; i++) {
    snowflake.generate();
  }
});

bench("decode single id", () => {
  const snowflake = new Snowflake(TEST_EPOCH, 1);
  const id = snowflake.generate();
  snowflake.decode(id);
});

bench("generate + decode 100 times", () => {
  const snowflake = new Snowflake(TEST_EPOCH, 1);
  for (let i = 0; i < 100; i++) {
    const id = snowflake.generate();
    snowflake.decode(id);
  }
});

bench("multiple instances (10) generating 100 ids each", () => {
  const instances = Array.from(
    { length: 10 },
    (_, i) => new Snowflake(TEST_EPOCH, i),
  );

  for (const instance of instances) {
    for (let i = 0; i < 100; i++) {
      instance.generate();
    }
  }
});

bench("round-trip (generate -> decode) 1000 times", () => {
  const snowflake = new Snowflake(TEST_EPOCH, 1);
  for (let i = 0; i < 1000; i++) {
    const id = snowflake.generate();
    snowflake.decode(id);
  }
});

bench("throughput - ids per second", () => {
  const snowflake = new Snowflake(TEST_EPOCH, 1);
  const startTime = performance.now();
  const endTime = startTime + 1000; // 1 second
  let count = 0;

  while (performance.now() < endTime) {
    snowflake.generate();
    count++;
  }

  return count;
});

await run();
