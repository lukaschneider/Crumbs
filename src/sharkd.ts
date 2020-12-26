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

    private request(req: string) {
        return new Promise(async (resolve, reject) => {
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
        spawn("sharkd", [socketURL.href]).on("error", (error) => {
            vscode.window.showErrorMessage(`Error while starting sharkd: ${error.message}`);
        });

        this.socket = new Promise<net.Socket>((resolve) => {
            const socket = new net.Socket();
            socket.connect(socketURL.pathname);
            socket.on("error", () => socket.connect(socketURL.pathname));
            socket.on("connect", () => resolve(socket));
        });
    }

    analyse() {
        return this.request(`{"req": "analyse"}\n`);
    }

    completeField(field: string) {
        return this.request(`{"req": "complete", "field": "${field}"}\n`);
    }

    checkFilter(filter: string) {
        return this.request(`{"req": "check", "filter": "${filter}"}\n`);
    }

    getFrame(frame: number) {
        return this.request(`{"req": "frame", "frame": ${frame}, "proto": 1, "bytes": 1}\n`);
    }

    getFrames(skip?: number, limit?: number) {
        return this.request(
            `{"req": "frames" ${skip ? `, "skip": ${skip}` : ""}} ${limit ? `, "limit": ${limit}` : ""}\n`,
        );
    }

    loadFile(uri: vscode.Uri) {
        return this.request(`{"req": "load", "file": "${uri.path}"}\n`);
    }
}
