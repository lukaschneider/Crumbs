import * as ndjson from "ndjson";
import * as net from "net";
import * as vscode from "vscode";
import { Mutex } from "async-mutex";
import { spawn } from "child_process";
import { URL } from "url";
import { v4 as uuid } from "uuid";

export class Sharkd {
    private socket: Promise<net.Socket>;
    private mutex: Mutex;

    private async request<T>(req: string) {
        return new Promise<T>(async (resolve, reject) => {
            const release = await this.mutex.acquire();
            try {
                (await this.socket).write(req);
                (await this.socket).pipe(ndjson.parse()).once("data", (res) => {
                    release();
                    resolve(res);
                });
            } catch {
                release();
                reject();
            }
        });
    }

    constructor() {
        this.mutex = new Mutex();

        const socketURL = new URL(`/tmp/vscode-crumbs-${uuid()}.sock`, "unix://");
        spawn(vscode.workspace.getConfiguration("crumbs").get("sharkd") || "sharkd", [socketURL.href]).on(
            "error",
            (error) => {
                vscode.window.showErrorMessage(`Error while starting sharkd: ${error.message}`);
            },
        );

        this.socket = new Promise<net.Socket>((resolve) => {
            const socket = new net.Socket();
            socket.setMaxListeners(1000);
            socket.connect(socketURL.pathname);
            socket.on("error", () => socket.connect(socketURL.pathname));
            socket.on("connect", () => {
                socket.removeAllListeners();
                resolve(socket);
            });
        });
    }

    async analyse() {
        return this.request(`{"req": "analyse"}\n`);
    }

    async checkField(field: string) {
        return this.request(`{"req": "check", "field": "${field}"}\n`);
    }

    async checkFilter(filter: string) {
        return this.request(`{"req": "check", "filter": "${filter}"}\n`);
    }

    async completeField(field: string) {
        return this.request(`{"req": "complete", "field": "${field}"}\n`);
    }

    async getFrame(frame: number) {
        return this.request<Frame>(`{"req": "frame", "frame": ${frame}, "proto": 1, "bytes": 1}\n`);
    }

    async getFrames(skip?: number, limit?: number) {
        const columns: Column[] = vscode.workspace.getConfiguration("crumbs").get("editor.columns") || [];

        const columnsString = columns
            .map((column, index) => {
                return `"column${index}": ${
                    column.type && column.type !== 6
                        ? column.type
                        : `"${column.field}:${column.occurence ? column.occurence : 0}"`
                }`;
            })
            .join(", ");

        return this.request<ColumnFrame[]>(
            `{"req": "frames", ${columnsString} ${skip ? `, "skip": ${skip}` : ""}} ${
                limit ? `, "limit": ${limit}` : ""
            }\n`,
        );
    }

    async getInfo() {
        return this.request(`{"req": "info"}\n`);
    }

    async loadFile(uri: vscode.Uri): Promise<boolean> {
        return (await this.request<SharkdError>(`{"req": "load", "file": "${uri.path}"}\n`)).err === 0;
    }
}
