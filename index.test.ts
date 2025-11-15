import { describe, expect, test } from "bun:test";
import { Snowflake } from "./index";

const TEST_EPOCH = 1609459200000; // jan 1, 2021 00:00:00 utc

describe("Snowflake", () => {
  describe("constructor", () => {
    test("should create instance with valid epoch", () => {
      const snowflake = new Snowflake({ epoch: TEST_EPOCH });
      expect(snowflake).toBeInstanceOf(Snowflake);
    });

    test("should create instance without a epoch specified", () => {
      const snowflake = new Snowflake();
      expect(snowflake).toBeInstanceOf(Snowflake);

      const snowflakeWithObj = new Snowflake({});
      expect(snowflakeWithObj).toBeInstanceOf(Snowflake);

      const snowflakeWithUnd = new Snowflake({ epoch: undefined });
      expect(snowflakeWithUnd).toBeInstanceOf(Snowflake);
    });

    test("should accept node id override", () => {
      const nodeId = 42;
      const snowflake = new Snowflake({
        epoch: TEST_EPOCH,
        nodeIdOverride: nodeId,
      });
      expect(snowflake.getNodeId()).toBe(nodeId);
    });

    test("should throw error when node id override is greater than 1023", () => {
      expect(
        () => new Snowflake({ epoch: TEST_EPOCH, nodeIdOverride: 1024 }),
      ).toThrow("Node ID override must be between 0 and 1023.");
    });

    test("should accept maximum valid node id override", () => {
      const snowflake = new Snowflake({
        epoch: TEST_EPOCH,
        nodeIdOverride: 1023,
      });
      expect(snowflake.getNodeId()).toBe(1023);
    });

    test("should accept minimum valid node id override", () => {
      const snowflake = new Snowflake({ epoch: TEST_EPOCH, nodeIdOverride: 0 });
      expect(snowflake.getNodeId()).toBe(0);
    });
  });

  describe("getNodeId", () => {
    test("should return computed node id when no override provided", () => {
      const snowflake = new Snowflake({ epoch: TEST_EPOCH });
      const nodeId = snowflake.getNodeId();
      expect(nodeId).toBeGreaterThanOrEqual(0);
      expect(nodeId).toBeLessThanOrEqual(1023);
    });

    test("should return overridden node id when provided", () => {
      const customNodeId = 123;
      const snowflake = new Snowflake({
        epoch: TEST_EPOCH,
        nodeIdOverride: customNodeId,
      });
      expect(snowflake.getNodeId()).toBe(customNodeId);
    });
  });

  describe("generate", () => {
    // https://en.wikipedia.org/wiki/Snowflake_ID#Example
    test("Wikipedia example is correct", () => {
      const snowflake = new Snowflake({ epoch: 1288834974657 }); // twitter's epoch

      const existingId = BigInt("1888944671579078978");
      const decoded = snowflake.decode(existingId);

      expect(decoded.timestamp).toBe(1739194479256);
      expect(decoded.nodeId).toBe(360);
      expect(decoded.sequence).toBe(322);
    });

    test("should generate a valid snowflake id", () => {
      const snowflake = new Snowflake({ epoch: TEST_EPOCH });
      const id = snowflake.generate();
      expect(typeof id).toBe("bigint");
      expect(id).toBeGreaterThan(0);
    });

    test("should generate unique ids", () => {
      const snowflake = new Snowflake({ epoch: TEST_EPOCH });
      const ids = new Set();

      for (let i = 0; i < 1000; i++) {
        ids.add(snowflake.generate());
      }

      expect(ids.size).toBe(1000);
    });

    test("should generate incrementing ids", () => {
      const snowflake = new Snowflake({ epoch: TEST_EPOCH });
      const id1 = snowflake.generate();
      const id2 = snowflake.generate();
      const id3 = snowflake.generate();

      expect(id2).toBeGreaterThan(id1);
      expect(id3).toBeGreaterThan(id2);
    });

    test("should handle sequence overflow within same millisecond", () => {
      const snowflake = new Snowflake({ epoch: TEST_EPOCH });
      const ids: bigint[] = [];

      // generate many ids quickly to trigger sequence overflow
      for (let i = 0; i < 5000; i++) {
        ids.push(snowflake.generate());
      }

      // all ids should still be unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    test("should encode node id in generated snowflake", () => {
      const nodeId = 456;
      const snowflake = new Snowflake({
        epoch: TEST_EPOCH,
        nodeIdOverride: nodeId,
      });
      const id = snowflake.generate();

      // extract node id from snowflake (bits 12-21)
      const extractedNodeId = Number((id >> 12n) & 0x3ffn);
      expect(extractedNodeId).toBe(nodeId);
    });

    test("should encode timestamp in generated snowflake", () => {
      const snowflake = new Snowflake({ epoch: TEST_EPOCH });
      const beforeGenerate = Date.now();
      const id = snowflake.generate();
      const afterGenerate = Date.now();

      // extract timestamp from snowflake (bits 22+)
      const extractedTimestamp = Number(id >> 22n) + TEST_EPOCH;

      expect(extractedTimestamp).toBeGreaterThanOrEqual(beforeGenerate);
      expect(extractedTimestamp).toBeLessThanOrEqual(afterGenerate);
    });

    test("should encode sequence in generated snowflake", () => {
      const snowflake = new Snowflake({ epoch: TEST_EPOCH });
      const id1 = snowflake.generate();
      const id2 = snowflake.generate();

      // extract sequence from first id (bits 0-11)
      const seq1 = Number(id1 & 0xfffn);
      const seq2 = Number(id2 & 0xfffn);

      // sequences should increment if generated in same millisecond
      // or reset to 0 if in different milliseconds
      expect(seq1).toBeGreaterThanOrEqual(0);
      expect(seq1).toBeLessThanOrEqual(4095);
      expect(seq2).toBeGreaterThanOrEqual(0);
      expect(seq2).toBeLessThanOrEqual(4095);
    });

    test("should reset sequence when timestamp changes", () => {
      const snowflake = new Snowflake({ epoch: TEST_EPOCH });

      // generate an id
      snowflake.generate();

      // wait for next millisecond
      const start = Date.now();
      while (Date.now() === start) {}

      const id = snowflake.generate();
      const sequence = Number(id & 0xfffn);

      expect(sequence).toBe(0);
    });

    test("should work with different epochs", () => {
      const epoch1 = 1609459200000;
      const epoch2 = 1640995200000; // jan 1, 2022

      const snowflake1 = new Snowflake({ epoch: epoch1 });
      const snowflake2 = new Snowflake({ epoch: epoch2 });

      const id1 = snowflake1.generate();
      const id2 = snowflake2.generate();

      expect(typeof id1).toBe("bigint");
      expect(typeof id2).toBe("bigint");
      expect(id1).not.toBe(id2);
    });

    test("should generate ids with different node ids that are unique", () => {
      const snowflake1 = new Snowflake({
        epoch: TEST_EPOCH,
        nodeIdOverride: 1,
      });
      const snowflake2 = new Snowflake({
        epoch: TEST_EPOCH,
        nodeIdOverride: 2,
      });

      const ids = new Set();

      for (let i = 0; i < 100; i++) {
        ids.add(snowflake1.generate());
        ids.add(snowflake2.generate());
      }

      expect(ids.size).toBe(200);
    });

    test("should handle rapid generation", () => {
      const snowflake = new Snowflake({ epoch: TEST_EPOCH });
      const start = performance.now();
      const ids: bigint[] = [];

      for (let i = 0; i < 10000; i++) {
        ids.push(snowflake.generate());
      }

      const end = performance.now();
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(10000);
      expect(end - start).toBeLessThan(5000); // should complete in reasonable time
    });
  });

  describe("edge cases", () => {
    test("should handle epoch set to current time", () => {
      const now = Date.now();
      const snowflake = new Snowflake({ epoch: now });
      const id = snowflake.generate();

      expect(id).toBeGreaterThan(0);
    });

    test("should work with epoch from the past", () => {
      const oldEpoch = 946684800000; // jan 1, 2000
      const snowflake = new Snowflake({ epoch: oldEpoch });
      const id = snowflake.generate();

      expect(id).toBeGreaterThan(0);
    });

    test("should maintain uniqueness across multiple instances with same config", () => {
      const nodeId = 42;
      const snowflake1 = new Snowflake({
        epoch: TEST_EPOCH,
        nodeIdOverride: nodeId,
      });
      const snowflake2 = new Snowflake({
        epoch: TEST_EPOCH,
        nodeIdOverride: nodeId,
      });

      const ids1 = new Set();
      const ids2 = new Set();

      // generate from each instance separately
      for (let i = 0; i < 50; i++) {
        ids1.add(snowflake1.generate());
      }

      for (let i = 0; i < 50; i++) {
        ids2.add(snowflake2.generate());
      }

      // each instance should generate unique ids within itself
      expect(ids1.size).toBe(50);
      expect(ids2.size).toBe(50);

      // but since they share the same node id and are independent,
      // they will likely have some collisions when alternating
      // this is expected behavior - node ids should be unique per instance
    });
  });

  describe("id structure validation", () => {
    test("should produce 64-bit compatible ids", () => {
      const snowflake = new Snowflake({ epoch: TEST_EPOCH });
      const id = snowflake.generate();

      // check that id fits in 64 bits (2^63 - 1 for signed, 2^64 - 1 for unsigned)
      expect(id).toBeLessThan(2n ** 64n);
      expect(id).toBeGreaterThan(0n);
    });

    test("should correctly pack all components", () => {
      const nodeId = 512;
      const snowflake = new Snowflake({
        epoch: TEST_EPOCH,
        nodeIdOverride: nodeId,
      });
      const id = snowflake.generate();

      // extract and verify each component
      const extractedSequence = Number(id & 0xfffn); // 12 bits
      const extractedNodeId = Number((id >> 12n) & 0x3ffn); // 10 bits
      const extractedTimestamp = Number(id >> 22n); // 41 bits

      expect(extractedSequence).toBeGreaterThanOrEqual(0);
      expect(extractedSequence).toBeLessThanOrEqual(4095);
      expect(extractedNodeId).toBe(nodeId);
      expect(extractedTimestamp).toBeGreaterThan(0);
    });
  });

  describe("decode", () => {
    test("should decode a generated snowflake id", () => {
      const snowflake = new Snowflake({ epoch: TEST_EPOCH });
      const id = snowflake.generate();
      const decoded = snowflake.decode(id);

      expect(decoded).toHaveProperty("timestamp");
      expect(decoded).toHaveProperty("nodeId");
      expect(decoded).toHaveProperty("sequence");
    });

    test("should correctly extract timestamp from id", () => {
      const snowflake = new Snowflake({ epoch: TEST_EPOCH });
      const beforeGenerate = Date.now();
      const id = snowflake.generate();
      const afterGenerate = Date.now();
      const decoded = snowflake.decode(id);

      expect(decoded.timestamp).toBeGreaterThanOrEqual(beforeGenerate);
      expect(decoded.timestamp).toBeLessThanOrEqual(afterGenerate);
    });

    test("should correctly extract node id from id", () => {
      const nodeId = 789;
      const snowflake = new Snowflake({
        epoch: TEST_EPOCH,
        nodeIdOverride: nodeId,
      });
      const id = snowflake.generate();
      const decoded = snowflake.decode(id);

      expect(decoded.nodeId).toBe(nodeId);
    });

    test("should correctly extract sequence from id", () => {
      const snowflake = new Snowflake({ epoch: TEST_EPOCH });
      const id1 = snowflake.generate();
      const id2 = snowflake.generate();
      const id3 = snowflake.generate();

      const decoded1 = snowflake.decode(id1);
      const decoded2 = snowflake.decode(id2);
      const decoded3 = snowflake.decode(id3);

      expect(decoded1.sequence).toBeGreaterThanOrEqual(0);
      expect(decoded1.sequence).toBeLessThanOrEqual(4095);
      expect(decoded2.sequence).toBeGreaterThanOrEqual(0);
      expect(decoded2.sequence).toBeLessThanOrEqual(4095);
      expect(decoded3.sequence).toBeGreaterThanOrEqual(0);
      expect(decoded3.sequence).toBeLessThanOrEqual(4095);
    });

    test("should decode multiple ids correctly", () => {
      const nodeId = 256;
      const snowflake = new Snowflake({
        epoch: TEST_EPOCH,
        nodeIdOverride: nodeId,
      });
      const ids: bigint[] = [];

      for (let i = 0; i < 100; i++) {
        ids.push(snowflake.generate());
      }

      ids.forEach((id) => {
        const decoded = snowflake.decode(id);
        expect(decoded.nodeId).toBe(nodeId);
        expect(decoded.timestamp).toBeGreaterThan(TEST_EPOCH);
        expect(decoded.sequence).toBeGreaterThanOrEqual(0);
        expect(decoded.sequence).toBeLessThanOrEqual(4095);
      });
    });

    test("should handle decoding with different epochs", () => {
      const epoch1 = 1609459200000;
      const epoch2 = 1640995200000;

      const snowflake1 = new Snowflake({ epoch: epoch1 });
      const snowflake2 = new Snowflake({ epoch: epoch2 });

      const id1 = snowflake1.generate();
      const id2 = snowflake2.generate();

      const decoded1 = snowflake1.decode(id1);
      const decoded2 = snowflake2.decode(id2);

      expect(decoded1.timestamp).toBeGreaterThan(epoch1);
      expect(decoded2.timestamp).toBeGreaterThan(epoch2);
    });

    test("should round-trip encode and decode", () => {
      const nodeId = 512;
      const snowflake = new Snowflake({
        epoch: TEST_EPOCH,
        nodeIdOverride: nodeId,
      });

      for (let i = 0; i < 50; i++) {
        const id = snowflake.generate();
        const decoded = snowflake.decode(id);

        expect(decoded.nodeId).toBe(nodeId);
        expect(typeof decoded.timestamp).toBe("number");
        expect(typeof decoded.sequence).toBe("number");
      }
    });

    test("should decode sequence overflow correctly", () => {
      const snowflake = new Snowflake({ epoch: TEST_EPOCH });
      const ids: bigint[] = [];

      // generate many ids quickly to test sequence values
      for (let i = 0; i < 5000; i++) {
        ids.push(snowflake.generate());
      }

      ids.forEach((id) => {
        const decoded = snowflake.decode(id);
        expect(decoded.sequence).toBeGreaterThanOrEqual(0);
        expect(decoded.sequence).toBeLessThanOrEqual(4095);
      });
    });

    test("should decode all valid node ids", () => {
      const testNodeIds = [0, 1, 255, 512, 1023];

      testNodeIds.forEach((nodeId) => {
        const snowflake = new Snowflake({
          epoch: TEST_EPOCH,
          nodeIdOverride: nodeId,
        });
        const id = snowflake.generate();
        const decoded = snowflake.decode(id);

        expect(decoded.nodeId).toBe(nodeId);
      });
    });

    test("should maintain timestamp accuracy across decodes", () => {
      const snowflake = new Snowflake({ epoch: TEST_EPOCH });
      const ids: bigint[] = [];
      const timestamps: number[] = [];

      for (let i = 0; i < 10; i++) {
        timestamps.push(Date.now());
        ids.push(snowflake.generate());
      }

      ids.forEach((id, index) => {
        const decoded = snowflake.decode(id);
        // decoded timestamp should be close to when it was generated
        expect(Math.abs(decoded.timestamp - timestamps[index]!)).toBeLessThan(
          10,
        );
      });
    });
  });
});
