import * as assert from "node:assert";
import * as vscode from "vscode";
import { Sharkd, type SharkdClient } from "../sharkd";

suite("sharkd", () => {
  vscode.window.showInformationMessage("Start sharkd tests.");

  suite("should spawn", () => {
    test("with default values", async () => {
      await assert.doesNotReject(async () => new Sharkd().getClient());
    });

    test("with a different profile", async () => {
      await assert.doesNotReject(
        async () => await new Sharkd("Classic").getClient(),
      );
    });
  });

  suite("should not spawn", () => {
    test("with missing profile", async () => {
      await assert.rejects(
        async () => await new Sharkd("NoProfile").getClient(),
      );
    });

    test("with missing profile and incorrected path", async () => {
      await assert.rejects(
        async () => await new Sharkd("NoProfile", "nosharkd").getClient(),
      );
    });

    test("with incorrect path", async () => {
      await assert.rejects(
        async () => await new Sharkd("Default", "nosharkd").getClient(),
      );
    });
  });

  suite("should handle", () => {
    let client: SharkdClient;

    setup(async () => {
      client = await new Sharkd().getClient();
    });

    test("analyse", async () => {
      const response = await client.request("analyse");
      assert.equal(response.frames, 0);
      assert.deepStrictEqual(response.protocols, []);
      assert.equal(response.first, undefined);
      assert.equal(response.last, undefined);
    });

    test.skip("analyse: with loaded pcap", async () => {
      // TODO
    });

    test("bye", async () => {
      const response = await client.request("bye");
      assert.equal(response.status, "OK");
    });

    test("check: field", async () => {
      const response = await client.request("check", { field: "tcp.srcport" });
      assert.equal(response.status, "OK");

      await assert.rejects(
        async () => await client.request("check", { field: "asdf" }),
      );
    });

    test("check: filter", async () => {
      const response = await client.request("check", {
        filter: "tcp.dstport == 80",
      });
      assert.equal(response.status, "OK");

      await assert.rejects(
        async () => await client.request("check", { filter: "asdf" }),
      );
    });

    test("check: both valid", async () => {
      const allValid = await client.request("check", {
        filter: "tcp.dstport == 80",
        field: "tcp.srcport",
      });
      assert.equal(allValid.status, "OK");
    });

    test("check: both field invalid", async () => {
      const filterValid = await client.request("check", {
        filter: "tcp.dstport == 80",
        field: "asdf",
      });
      assert.equal(filterValid.status, "OK");
    });

    test("check: both filter invalid", async () => {
      await assert.rejects(
        async () =>
          await client.request("check", {
            filter: "asdf",
            field: "tcp.srcport",
          }),
      );
    });

    test("complete: field", async () => {
      const response = await client.request("complete", { field: "tcp." });
      assert.equal(response.pref, undefined);
      assert.equal(response.field?.length, 278);
      assert.equal(response.field?.at(19)?.f, "tcp.srcport");
      assert.equal(response.field?.at(19)?.n, "Source Port");

      const errorResponse = await client.request("complete", { field: "asdf" });
      assert.equal(errorResponse.field?.length, 0);
      assert.equal(errorResponse.pref, undefined);
    });

    test("complete: pref", async () => {
      const response = await client.request("complete", { pref: "tcp" });
      assert.equal(response.field, undefined);
      assert.equal(response.pref?.length, 4);
      assert.equal(response.pref?.at(0)?.f, "tcp");
      assert.equal(response.pref?.at(0)?.d, "TCP");

      const errorResponse = await client.request("complete", { pref: "asdf" });
      assert.equal(errorResponse.pref?.length, 0);
      assert.equal(errorResponse.field, undefined);
    });

    test("complete: both valid", async () => {
      const response = await client.request("complete", {
        field: "tcp",
        pref: "tcp",
      });
      assert.equal(response.field?.length, 31);
      assert.equal(response.pref?.length, 4);
    });

    test("complete: both perf invalid", async () => {
      const response = await client.request("complete", {
        field: "tcp",
        pref: "asdf",
      });
      assert.equal(response.field?.length, 31);
      assert.equal(response.pref?.length, 0);
    });

    test("complete: both field invalid", async () => {
      const response = await client.request("complete", {
        field: "asdf",
        pref: "tcp",
      });
      assert.equal(response.field?.length, 0);
      assert.equal(response.pref?.length, 4);
    });

    test("dumpconf: no pref set", async () => {
      const response = await client.request("dumpconf", {});
      assert.ok(Object.keys(response.prefs).length > 0);
    });

    test("dumpconf: specific pref set", async () => {
      const pref = "gui.column.format";

      const response = await client.request("dumpconf", {
        pref: pref,
      });
      assert.equal(Object.keys(response.prefs).length, 1);
      assert.equal(Object.keys(response.prefs)[0], pref);
    });

    test.skip("frame: with pcap", async () => {});

    test("frame: no pcap", async () => {
      await assert.rejects(
        async () => await client.request("frame", { frame: 99 }),
      );
    });

    test.skip("frames: with pcap", async () => {});

    test("frames: invalid column", async () => {
      await assert.rejects(
        async () => await client.request("frames", { column0: "asdf" }),
      );
    });

    test("frames: non-sequential column indexes", async () => {
      // TODO: test with loaded pcap
      const response = await client.request("frames", {
        column1: "tcp.srcport",
        column3: "tcp.dstport",
      });
      assert.equal(response.length, 0);
    });

    test("frames: no pcap", async () => {
      const response = await client.request("frames", {});
      assert.equal(response.length, 0);
    });

    test("info", async () => {
      const response = await client.request("info");
      assert.ok(response.columns.length > 0);
      // TODO: assert other properties if needed
    });

    test.skip("load: valid pcap", async () => {});

    test("load: invalid path", async () => {
      await assert.rejects(
        async () =>
          await client.request("load", {
            file: "nope",
          }),
      );
    });

    test("status", async () => {
      const response = await client.request("status");
      assert.equal(response.frames, 0);
      assert.equal(response.duration, 0);
    });
  });
});
