import * as ndjson from "ndjson"
import * as vscode from "vscode"
import { ChildProcess, spawn } from "child_process"
import { Socket } from "net"
import { Mutex } from "async-mutex"
import { URL as url } from "url"
import { v4 as uuid } from "uuid"

export default class Document extends vscode.Disposable implements vscode.CustomDocument {
    uri: vscode.Uri

    private mutex: Mutex
    private socket: Promise<Socket>
    private process: ChildProcess

    constructor(uri: vscode.Uri) {
        super(() => { this.process.kill() })

        this.uri = uri
        this.mutex = new Mutex()

        const socketUrl = new url(`/tmp/vscode-crumbs-${uuid()}.sock`, "unix://")
        const sharkd: string = vscode.workspace.getConfiguration("crumbs").get("sharkd") || "sharkd"

        this.process = spawn(sharkd, [socketUrl.href]).on("error", error => {
            vscode.window.showErrorMessage(`Could not start sharkd: ${error.message}`)
        })

        this.socket = new Promise<Socket>(resolve => {
            const socket = new Socket().connect(socketUrl.pathname)

            socket.on("error", () => socket.connect(socketUrl.pathname))
            socket.on("connect", () => resolve(socket.removeAllListeners()))
        })

        vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Window,
                title: `Loading ${uri.path}`,
            },
            async () => {
                this.request<SharkdLoadFileRequest, void>({ req: "load", file: uri.path })
            })
    }

    getFrames(columns: ConfigColumn[], skip: number, limit: number) {
        return this.request<SharkdGetFramesRequest, SharkdFrame[]>(Object.assign(
            {
                req: "frames",
                skip: skip,
                limit: limit
            },
            ...columns.map((column, index) => {
                return {
                    [`column${index}`]: (column.type && column.type !== 6) ?
                        column.type :
                        `${column.field}:${column.occurence || 0}`
                }
            })
        ))
    }

    private request<RequestType, ResponseType>(request: RequestType): Promise<ResponseType> {
        return new Promise(async resolve => {
            const release = await this.mutex.acquire()
            const socket = await this.socket

            try {
                socket.write(JSON.stringify(request) + "\n")
                socket.pipe(ndjson.parse()).once("data", async response => {
                    socket.removeAllListeners()
                    release()
                    resolve(response)
                })
            } catch {
                release()
            }
        })
    }
}
