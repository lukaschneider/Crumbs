import * as assert from "node:assert/strict";
import * as vscode from "vscode";
import { sharkdPath } from "./sharkd.test";
import PcapDocument from "../pcapDocument";

export async function testExtension(file: string) {
  const extension = vscode.extensions.all.find(
    (item) =>
      item.packageJSON.name === "crumbs" &&
      item.extensionPath === process.env.CRUMBS_EXTENSION_PATH,
  );
  assert.ok(extension, "Development extension must be discoverable");
  await extension.activate();
  const commands = await vscode.commands.getCommands(true);
  assert.ok(commands.includes("frameTreeReveal"));
  for (const mode of ["apply", "prepare"]) {
    for (const operation of [
      "selected",
      "not",
      "and",
      "or",
      "and-not",
      "or-not",
    ]) {
      assert.ok(commands.includes(`crumbs.filter.${mode}.${operation}`));
    }
  }
  const config = vscode.workspace.getConfiguration("crumbs");
  const previous = config.inspect<string>("sharkd")?.globalValue;
  await config.update(
    "sharkd",
    sharkdPath(),
    vscode.ConfigurationTarget.Global,
  );
  try {
    const document = new PcapDocument(vscode.Uri.file(file));
    try {
      assert.equal((await document.load()).analyse.frames, 2);
    } finally {
      document.dispose();
      document.dispose();
    }
    await vscode.commands.executeCommand(
      "vscode.openWith",
      vscode.Uri.file(file),
      "crumbsFrameList",
    );
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  } finally {
    await config.update("sharkd", previous, vscode.ConfigurationTarget.Global);
  }
}
