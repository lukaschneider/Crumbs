import * as assert from "node:assert/strict";
import { Sharkd } from "../sharkd";
import { framePage } from "../framePaging";
import { resolveSharkdPath } from "../sharkdPath";
import { CaptureFilters } from "../captureFilters";
import { combineFilter } from "../filterSyntax";
import type { TreeNode } from "../types/sharkd";

export function sharkdPath() {
  return process.env.SHARKD_PATH ?? resolveSharkdPath();
}

export async function testSharkd(file: string) {
  const sharkd = new Sharkd("Default", sharkdPath());
  try {
    const [client, second] = await Promise.all([
      sharkd.getClient(),
      sharkd.getClient(),
    ]);
    assert.equal(client, second);
    assert.equal((await client.request("status")).frames, 0);
    await client.request("load", { file });
    const analysis = await client.request("analyse");
    assert.equal(analysis.frames, 2);
    const info = await client.request("info");
    assert.ok(info.columns.length > 0);
    const firstPage = await client.request("frames", {
      ...framePage(0, 1),
      column0: info.columns.findIndex((column) => column.format === "%m"),
    });
    assert.equal(firstPage.length, 1);
    assert.equal(firstPage[0].num, 1);
    const frames = await client.request("frames", {
      ...framePage(1, 2),
      column0: info.columns.findIndex((column) => column.format === "%m"),
    });
    assert.equal(frames.length, 1);
    assert.equal(frames[0].num, 2);
    assert.equal(frames[0].c[0], "2");
    const frame = await client.request("frame", {
      frame: 1,
      bytes: true,
      proto: true,
    });
    assert.equal(Buffer.from(frame.bytes ?? "", "base64").length, 42);
    assert.ok(frame.tree?.length);
    const filters = new CaptureFilters(async () => ({
      client,
      analyse: analysis,
      info,
    }));
    assert.equal((await filters.validate("udp.srcport ==")).valid, false);
    assert.equal((await filters.validate("udp.srcport == 1234")).valid, true);
    assert.equal(await filters.count("frame.number == 2"), 1);
    assert.equal(await filters.count("tcp"), 0);
    assert.equal(await filters.count(""), 2);
    const filteredPage = await client.request("frames", {
      filter: "frame.number == 2",
      ...framePage(0, 1),
    });
    assert.equal(filteredPage[0].num, 2);
    const filteredSecond = await client.request("frames", {
      filter: "udp",
      ...framePage(1, 2),
    });
    assert.equal(filteredSecond[0].num, 2);
    const text = "udp.srcport == ";
    assert.ok(
      (await filters.complete(text, text.length)).items.some(
        (item) => item.text === "1234",
      ),
    );
    const addresses = "ip.addr == ";
    assert.ok(
      (await filters.complete(addresses, addresses.length)).items.some(
        (item) => item.text === "192.0.2.1",
      ),
    );
    const walk = (nodes: TreeNode[]): TreeNode[] =>
      nodes.flatMap((node) => [node, ...walk(node.n ?? [])]);
    const expression = walk(frame.tree ?? []).find((node) =>
      node.f?.startsWith("udp.srcport =="),
    )?.f;
    assert.ok(expression);
    assert.equal(
      await filters.count(
        combineFilter("frame.number == 2", expression, "and"),
      ),
      1,
    );
    assert.equal(await filters.count(combineFilter("", expression, "not")), 0);
    await assert.rejects(async () => client.request("frame", { frame: 99 }));
    const completion = await client.request("complete", { field: "tcp.srcp" });
    assert.ok(completion.field?.some((field) => field.f === "tcp.srcport"));
    assert.equal(
      (await client.request("check", { field: "tcp.srcport" })).status,
      "OK",
    );
    await assert.rejects(async () =>
      client.request("check", { field: "not_a_valid_crumbs_field" }),
    );
    await assert.rejects(async () =>
      client.request("load", { file: `${file}.missing` }),
    );
  } finally {
    sharkd.stop();
  }
}
