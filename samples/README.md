# Crumbs demo capture

[crumbs-demo.pcap](crumbs-demo.pcap) is a small, entirely synthetic capture: 37 Ethernet frames, documentation-range IP addresses (`192.0.2.0/24`), locally administered MAC addresses, and `.example` names. Nothing was captured from a real network. The file is covered by the repository's MIT license.

Open it in Crumbs and try:

| Filter | What to explore |
| --- | --- |
| `http` | Two complete HTTP exchanges, including a request to `/since/2020-12-26`. |
| `http.response.code == 418` | A server with a very particular opinion about brewing coffee. |
| `dns` | A records, a TXT answer, and an NXDOMAIN response. |
| `dns.qry.type == 16` | The UDP joke is in the TXT response's protocol tree and bytes. |
| `icmp` | Two successful echo request/reply pairs. |
| `tcp.stream == 0` | A complete TCP handshake, request, response, and orderly shutdown. |

The capture starts at **2020-12-26 15:09:57 UTC**, the timestamp of the original Crumbs repository's [first commit](https://github.com/lukaschneider/Crumbs/commit/71d42fd401d988a5ac754c77234339c961b356d8). The first HTTP response carries the same date; the TCP initial sequence numbers hide it too. These are deliberate references, not historical network traffic.

Regenerate the file byte-for-byte with Node.js:

```sh
npm run demo:capture
```

The generator writes valid IPv4, TCP, UDP, and ICMP checksums, correct TCP sequence/acknowledgment numbers, and Ethernet padding. It uses only Node's standard library and makes no network requests.
