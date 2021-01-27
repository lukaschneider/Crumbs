import * as ndjson from "ndjson";
import * as net from "net";
import * as vscode from "vscode";
import { Mutex } from "async-mutex";
import { spawn } from "child_process";
import { URL } from "url";
import { v4 as uuid } from "uuid";

export default class SharkdProvider {
    private requestMutex: Mutex;
    private socket: Promise<net.Socket>;

    constructor() {
        this.requestMutex = new Mutex();

        const socketURL = new URL(`/tmp/vscode-crumbs-${uuid()}.sock`, "unix://");
        const sharkdCommand: string = vscode.workspace.getConfiguration("crumbs").get("sharkd") || "sharkd";

        spawn(sharkdCommand, [socketURL.href]).on("error", (error) => {
            vscode.window.showErrorMessage(`Error while starting sharkd: ${error.message}.`);
        });

        this.socket = new Promise<net.Socket>((resolve) => {
            const socket = new net.Socket();

            socket.setMaxListeners(1000);
            socket.connect(socketURL.pathname);

            socket.on("error", () => socket.connect(socketURL.pathname));
            socket.on("connect", () => resolve(socket.removeAllListeners()));
        });
    }

    private request<ResponseType>(request: string) {
        return new Promise<ResponseType>(async (resolve, reject) => {
            const releaseRequestMutex = await this.requestMutex.acquire();
            try {
                (await this.socket).write(request);
                (await this.socket).pipe(ndjson.parse()).once("data", (response) => {
                    releaseRequestMutex();
                    resolve(response);
                });
            } catch (error) {
                releaseRequestMutex();
                reject();
            }
        });
    }

    async getRows(skip?: number, limit?: number) {
        const columns: CrumbsConfigColumn[] = vscode.workspace.getConfiguration("crumbs").get("editor.columns") || [];

        const columnsRequest = columns.map((column, index) => {
            if (column.type && column.type !== 6) {
                return `"column${index}":${column.type},`;
            } else {
                if (!column.occurence) {
                    column.occurence = 0;
                }
                return `"column${index}":"${column.field}:${column.occurence}"`;
            }
        });

        return this.request<SharkdRow[]>(
            `{"req": "frames", ${skip ? `"skip":` + skip : ""}, ${limit ? `"limit":` + limit : ""}, ${columnsRequest}}\n`,
        );
    }

    async loadFile(path: string) {
        const response = await this.request<SharkdError>(`{"req": "load", "file": "${path}"}\n`);
        return response.err === 0;
    }
}
