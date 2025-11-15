import { networkInterfaces } from "os";

class SnowflakeError extends Error {}

/**
 * Snowflake class that generates unique IDs.
 *
 * This snowflake implementation follows the original Twitter Snowflake algorithm (https://en.wikipedia.org/wiki/Snowflake_ID) and has been inspired by pika-ids (https://github.com/Phineas/pika/) for node id generation.
 */
export class Snowflake {
  private epoch: bigint;
  private sequence: number = 0;
  private nodeId: number = this.computeNodeId();
  private lastTimestamp: bigint = -1n;

  /**
   *
   * @param epoch An EPOCH override in milliseconds (MUST BE IN MILLISECONDS)
   * @param nodeIdOverride If provided, this node id will be used instead of computing it from the MAC address, this may be useful if you are in an environment where MAC addresses are not available. Please ensure that node IDs are unique across all instances to avoid ID collisions.
   */
  constructor({
    epoch = 1288834974657, // default to use twitter's snowflake epoch (November 4, 2010)
    nodeIdOverride,
  }: Partial<{
    /**
     * The epoch to base your IDs off of. **MUST BE UNIX TIMESTAMP IN MILLISECONDS**
     *
     * @example 1288834974657 // (November 4, 2010)
     */
    epoch?: number;
    /**
     * Providing a nodeId (aka machine ID) override will skip generation based off the MAC address of the first valid network interface found.
     *
     * This may be useful in environments where MAC addresses are not available.
     *
     * Please ensure that node IDs are unique across all instances to avoid ID collisions.
     *
     * @example 123 // (node/machine ID 123)
     */
    nodeIdOverride?: number;
  }> = {}) {
    if (nodeIdOverride !== undefined) {
      if (nodeIdOverride > 1023) {
        throw new SnowflakeError(
          "Node ID override must be between 0 and 1023.",
        );
      }

      this.nodeId = nodeIdOverride;
    }

    this.epoch = BigInt(epoch);
  }

  /**
   * Gets the node/machine ID used by this Snowflake instance.
   *
   * By default, this is computed from the MAC address of the machine's network interfaces. If a node ID override was provided during instantiation, that value will be returned instead. If no valid MAC address could be found and no override was provided, a random integer between 0 and 1023 is used, which may lead to collisions in distributed systems.
   *
   * @returns the ID of the node/machine
   */
  public getNodeId(): number {
    return this.nodeId;
  }

  /**
   * Generates a new snowflake ID.
   *
   * The snowflake ID is a 64-bit integer with the following bit layout:
   * ```
   * ┌─────────────────────────────────────────────┬───────────────┬───────────────────┐
   * │          Timestamp (41 bits)                │ Node (10 bits)│ Sequence (12 bits)│
   * │  Milliseconds since custom epoch            │   Machine ID  │   Per-ms counter  │
   * └─────────────────────────────────────────────┴───────────────┴───────────────────┘
   *  63                                            22              12               0
   * ```
   *
   * @important This method is synchronous and will block the event loop if the sequence overflows within the same millisecond, as it will wait for the next millisecond to continue generating IDs.
   *
   * @returns a bigint representing the snowflake ID
   */
  public generate(): bigint {
    const now = BigInt(Date.now());

    if (now - this.epoch < this.lastTimestamp) {
      throw new SnowflakeError(
        "Time since epoch is less than the last time an ID was generated. This indicates the clock has moved backwards, rejecting to generate an ID to avoid potential collisions.",
      );
    }

    if (now - this.epoch === this.lastTimestamp) {
      this.sequence = (this.sequence + 1) & 0xfff; // max 4095 per millisecond

      if (this.sequence === 0) {
        // seq overflowed, waiting for next millisecond
        while (BigInt(Date.now()) - this.epoch <= this.lastTimestamp) {}
      }
    } else {
      this.sequence = 0;
    }

    const timestampSinceEpoch = BigInt(Date.now()) - this.epoch;
    this.lastTimestamp = timestampSinceEpoch;

    const id =
      (timestampSinceEpoch << 22n) | // shift left 22 bits (10 bits for node id + 12 bits for sequence)
      (BigInt(this.nodeId) << 12n) | // shift left 12 bits for sequence
      BigInt(this.sequence); // fill last 12 bits

    return id;
  }

  /**
   * Decodes a snowflake ID into its constituent parts: timestamp, node ID, and sequence number.
   *
   * @example
   * ```ts
   * const snowflake = new Snowflake(1609459200000); // Custom epoch: January 1, 2021
   * const id = snowflake.generate();
   * const decoded = snowflake.decode(id);
   * console.log(decoded);
   * // {
   * //   timestamp: 1617187200000,  (March 30, 2021 00:00:00 GMT)
   * //   nodeId: 123,               (node/machine ID 123)
   * //   sequence: 14               (14th ID created within the same millisecond)
   * // }
   * ```
   *
   * @param snowflakeId the snowflake ID to decode
   * @returns an object containing the timestamp, node ID, and sequence number
   */
  public decode(snowflakeId: bigint): {
    /**
     * The unix timestamp in which the ID was created
     *
     * @example 1617187200000 // (March 30, 2021 00:00:00 GMT)
     */
    timestamp: number;
    /**
     * the node/machine that created the ID

     @example 123 // (node/machine ID 123)
     */
    nodeId: number;
    /**
     * The sequence of the ID
     *
     * @example 14 // (14th ID created within the same millisecond)
     */
    sequence: number;
  } {
    const timestamp =
      Number((snowflakeId >> 22n) & 0x1ffffffffffn) + Number(this.epoch); // shift right 22 bits and mask 41 bits
    const nodeId = Number((snowflakeId >> 12n) & 0x3ffn); // shift right 12 bits and mask 10 bits
    const sequence = Number(snowflakeId & 0xfffn); // mask 12 bits

    return {
      timestamp,
      nodeId,
      sequence,
    };
  }

  /**
   * Creates a node id from the mac address of the network interfaces attached
   *
   * @important If no valid MAC address is found a random integer between 0 and 1023 will be used instead, which may lead to collisions in distributed systems.
   */
  private computeNodeId(): number {
    try {
      const firstValidMacAddress = Object.values(networkInterfaces()).filter(
        (i) => i && i[0]?.mac !== "00:00:00:00:00:00",
      )?.[0]?.[0]?.mac;

      if (!firstValidMacAddress) {
        throw new SnowflakeError(
          "No valid MAC Address has been found. @lawg.dev/snowflake requires a valid MAC Address to compute a snowflake's node (aka machine) ID. A random integer between 0 and 1023 will be used instead.",
        );
      }

      // we need to parse the mac address into an integer that fits into 10 bits (0-1023)
      // the radix is 16 because mac addresses are in hex
      return parseInt(firstValidMacAddress.split(":").join(""), 16) % 1024;
    } catch (error) {
      console.error(error);

      // fallback to a random integer between 0 and 1023
      // this means that there is a small chance of collision
      return Math.floor(Math.random() * 1024);
    }
  }
}
