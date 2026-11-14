import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureFixture } from "./fixtures";
import { testSharkd } from "./sharkd.test";
import { testExtension } from "./extension.test";

export async function run() {
  const folder = await mkdtemp(join(tmpdir(), "crumbs-tests-"));
  const file = join(folder, "capture with spaces.pcap");
  try {
    await writeFile(file, captureFixture());
    await testSharkd(file);
    console.log(
      "PASS: real sharkd capture, paging, protocol tree, validation and cleanup",
    );
    await testExtension(file);
    console.log(
      "PASS: extension activation, native document paths and custom editor",
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
