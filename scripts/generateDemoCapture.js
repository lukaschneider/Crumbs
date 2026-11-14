// A deterministic, synthetic Ethernet capture. No live traffic or dependencies.
// First original Crumbs commit: 71d42fd401d988a5ac754c77234339c961b356d8
// https://github.com/lukaschneider/Crumbs/commit/71d42fd401d988a5ac754c77234339c961b356d8
const fs = require("node:fs");
const path = require("node:path");

const epoch = Date.parse("2020-12-26T15:09:57Z") / 1000;
const client = { ip: "192.0.2.10", mac: "020000000010" };
const server = { ip: "192.0.2.80", mac: "020000000080" };
const resolver = { ip: "192.0.2.53", mac: "020000000053" };
const ipBytes = (ip) => Buffer.from(ip.split(".").map(Number));
const macBytes = (mac) => Buffer.from(mac, "hex");
const packets = [];
let identification = 1;

function checksum(bytes) {
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 2) {
    sum += (bytes[i] << 8) | (bytes[i + 1] ?? 0);
  }
  while (sum >>> 16) sum = (sum & 0xffff) + (sum >>> 16);
  return (~sum) & 0xffff;
}

function ethernet(from, to, type, payload) {
  const header = Buffer.alloc(14);
  macBytes(to.mac).copy(header);
  macBytes(from.mac).copy(header, 6);
  header.writeUInt16BE(type, 12);
  const frame = Buffer.concat([header, payload]);
  packets.push(frame.length < 60 ? Buffer.concat([frame, Buffer.alloc(60 - frame.length)]) : frame);
}

function ipv4(from, to, protocol, segment) {
  const header = Buffer.alloc(20);
  header[0] = 0x45;
  header.writeUInt16BE(header.length + segment.length, 2);
  header.writeUInt16BE(identification++, 4);
  header.writeUInt16BE(0x4000, 6);
  header[8] = 64;
  header[9] = protocol;
  ipBytes(from.ip).copy(header, 12);
  ipBytes(to.ip).copy(header, 16);
  header.writeUInt16BE(checksum(header), 10);
  ethernet(from, to, 0x0800, Buffer.concat([header, segment]));
}

function transportChecksum(from, to, protocol, segment) {
  const pseudo = Buffer.alloc(12);
  ipBytes(from.ip).copy(pseudo);
  ipBytes(to.ip).copy(pseudo, 4);
  pseudo[9] = protocol;
  pseudo.writeUInt16BE(segment.length, 10);
  return checksum(Buffer.concat([pseudo, segment]));
}

function arp(from, to, reply) {
  const payload = Buffer.alloc(28);
  payload.writeUInt16BE(1);
  payload.writeUInt16BE(0x0800, 2);
  payload[4] = 6;
  payload[5] = 4;
  payload.writeUInt16BE(reply ? 2 : 1, 6);
  macBytes(from.mac).copy(payload, 8);
  ipBytes(from.ip).copy(payload, 14);
  if (reply) macBytes(to.mac).copy(payload, 18);
  ipBytes(to.ip).copy(payload, 24);
  ethernet(from, reply ? to : { mac: "ffffffffffff" }, 0x0806, payload);
}

function udp(from, to, sourcePort, destinationPort, payload) {
  const segment = Buffer.alloc(8 + payload.length);
  segment.writeUInt16BE(sourcePort);
  segment.writeUInt16BE(destinationPort, 2);
  segment.writeUInt16BE(segment.length, 4);
  payload.copy(segment, 8);
  segment.writeUInt16BE(transportChecksum(from, to, 17, segment) || 0xffff, 6);
  ipv4(from, to, 17, segment);
}

function dns(name, id, { text, missing = false } = {}) {
  const labels = name.split(".").map((label) => Buffer.concat([Buffer.from([label.length]), Buffer.from(label)]));
  const type = text ? 16 : 1;
  const question = Buffer.concat([...labels, Buffer.from([0, 0, type, 0, 1])]);
  const query = Buffer.alloc(12);
  query.writeUInt16BE(id);
  query.writeUInt16BE(0x0100, 2);
  query.writeUInt16BE(1, 4);
  const port = 53000 + (id % 1000);
  udp(client, resolver, port, 53, Buffer.concat([query, question]));
  const response = Buffer.from(query);
  response.writeUInt16BE(missing ? 0x8183 : 0x8180, 2);
  response.writeUInt16BE(missing ? 0 : 1, 6);
  const answer = Buffer.alloc(12);
  answer.writeUInt16BE(0xc00c);
  answer.writeUInt16BE(type, 2);
  answer.writeUInt16BE(1, 4);
  answer.writeUInt32BE(300, 6);
  const data = text ? Buffer.concat([Buffer.from([Buffer.byteLength(text)]), Buffer.from(text)]) : ipBytes(server.ip);
  answer.writeUInt16BE(data.length, 10);
  udp(resolver, client, 53, port, Buffer.concat(missing ? [response, question] : [response, question, answer, data]));
}

function tcp(from, to, sourcePort, destinationPort, sequence, acknowledgment, flags, data = "") {
  const payload = Buffer.from(data);
  const segment = Buffer.alloc(20 + payload.length);
  segment.writeUInt16BE(sourcePort);
  segment.writeUInt16BE(destinationPort, 2);
  segment.writeUInt32BE(sequence, 4);
  segment.writeUInt32BE(acknowledgment, 8);
  segment[12] = 0x50;
  segment[13] = flags;
  segment.writeUInt16BE(64240, 14);
  payload.copy(segment, 20);
  segment.writeUInt16BE(transportChecksum(from, to, 6, segment), 16);
  ipv4(from, to, 6, segment);
}

function http(port, host, resource, status, body) {
  let c = 150957;
  let s = 20201226;
  const send = (flags, data) => tcp(client, server, port, 80, c, s, flags, data);
  const receive = (flags, data) => tcp(server, client, 80, port, s, c, flags, data);
  tcp(client, server, port, 80, c++, 0, 0x02);
  receive(0x12);
  s++;
  send(0x10);
  const request = `GET ${resource} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: Crumbs-Demo/1.0\r\nAccept: application/json\r\nConnection: close\r\n\r\n`;
  send(0x18, request);
  c += Buffer.byteLength(request);
  receive(0x10);
  const response = `HTTP/1.1 ${status}\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\nX-Crumbs-Since: 2020-12-26\r\nConnection: close\r\n\r\n${body}`;
  receive(0x18, response);
  s += Buffer.byteLength(response);
  send(0x10);
  receive(0x11);
  s++;
  send(0x10);
  send(0x11);
  c++;
  receive(0x10);
}

function ping(sequence, message) {
  for (const reply of [false, true]) {
    const payload = Buffer.alloc(8 + Buffer.byteLength(message));
    payload[0] = reply ? 0 : 8;
    payload.writeUInt16BE(0x1226, 4);
    payload.writeUInt16BE(sequence, 6);
    payload.write(message, 8);
    payload.writeUInt16BE(checksum(payload), 2);
    ipv4(reply ? server : client, reply ? client : server, 1, payload);
  }
}

arp(client, server, false);
arp(server, client, true);
dns("crumbs.example", 0x1226);
http(50001, "crumbs.example", "/since/2020-12-26", "200 OK", JSON.stringify({
  project: "Crumbs",
  first_commit: "2020-12-26T15:09:57Z",
  message: "Every packet leaves a trace.",
}) + "\n");
dns("udp.example", 0x2020, { text: "I'd tell you a UDP joke, but you might not get it." });
ping(1, "Are you there? ACK, I am.");
dns("teapot.example", 0x0418);
http(50002, "teapot.example", "/brew", "418 I'm a teapot", JSON.stringify({
  status: 418,
  message: "TCP walks into a bar. First, a handshake.",
}) + "\n");
udp(client, server, 49152, 9, Buffer.from("No response expected. Working as designed."));
dns("its-always-dns.example", 0x0053, { missing: true });
ping(2, "Small crumbs. Clear connections.");

const header = Buffer.alloc(24);
header.writeUInt32LE(0xa1b2c3d4);
header.writeUInt16LE(2, 4);
header.writeUInt16LE(4, 6);
header.writeUInt32LE(65535, 16);
header.writeUInt32LE(1, 20); // Ethernet, without FCS.
const records = packets.map((packet, index) => {
  const record = Buffer.alloc(16);
  const microseconds = index * 120000;
  record.writeUInt32LE(epoch + Math.floor(microseconds / 1000000));
  record.writeUInt32LE(microseconds % 1000000, 4);
  record.writeUInt32LE(packet.length, 8);
  record.writeUInt32LE(packet.length, 12);
  return Buffer.concat([record, packet]);
});
const output = path.join(__dirname, "../samples/crumbs-demo.pcap");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, Buffer.concat([header, ...records]));
console.log(`Wrote ${packets.length} synthetic packets to ${output}`);
