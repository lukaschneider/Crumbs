import * as vscode from "vscode";

import SharkdProvider from "./sharkdProvider";

export default class CrumbsDocument extends vscode.Disposable implements vscode.CustomDocument {
    sharkd: SharkdProvider;
    uri: vscode.Uri;

    constructor(uri: vscode.Uri) {
        super(() => {});
        this.sharkd = new SharkdProvider();
        this.uri = uri;
    }
}
