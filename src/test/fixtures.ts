/** A deterministic two-packet Ethernet/IPv4/UDP pcap, generated without external tools. */
export function captureFixture() {
  const packet = Buffer.from(
    "00112233445566778899aabb08004500001c0001000040110000c0000201c633640204d2162e00080000",
    "hex",
  );
  const header = Buffer.alloc(24);
  header.writeUInt32LE(0xa1b2c3d4, 0);
  header.writeUInt16LE(2, 4);
  header.writeUInt16LE(4, 6);
  header.writeUInt32LE(65535, 16);
  header.writeUInt32LE(1, 20);
  const records = [0, 1].map((index) => {
    const record = Buffer.alloc(16);
    record.writeUInt32LE(1700000000 + index, 0);
    record.writeUInt32LE(packet.length, 8);
    record.writeUInt32LE(packet.length, 12);
    return Buffer.concat([record, packet]);
  });
  return Buffer.concat([header, ...records]);
}
