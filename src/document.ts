import * as ndjson from "ndjson"
import * as vscode from "vscode"
import { ChildProcess, spawn } from "child_process"
import { Socket } from "net"
import { Mutex } from "async-mutex"
import { URL as url } from "url"
import { v4 as uuid } from "uuid"
import { isEqual, omit, uniqWith } from "lodash"

export default class Document extends vscode.Disposable implements vscode.CustomDocument {
    uri: vscode.Uri

    private socket!: Promise<Socket>
    private process!: ChildProcess
    private requestMutex: Mutex
    private disposeEvent = new vscode.EventEmitter<void>()
    private jsonRPC2: boolean

    constructor(uri: vscode.Uri) {
        super(() => this.dispose())

        this.uri = uri
        this.requestMutex = new Mutex()

        this.jsonRPC2 = true

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
                const response = await this.request<SharkdLoadFileRequest, SharkdLoadFileResponse>({ method: "load", file: uri.path })
                if (response.err === 2) {
                    vscode.window.showErrorMessage(`${this.uri.path} does not exist!`)
                }
            })
    }

    async dispose() {
        (await this.socket).end()
        this.process.kill()
        this.disposeEvent.fire()
    }

    readonly onDispose = this.disposeEvent.event

    getFrames(columns: ConfigColumn[], skip: number, limit: number) {
        return this.request<SharkdGetFramesRequest, SharkdFrame[]>(Object.assign(
            {
                method: "frames",
                skip: skip === 0 ? undefined : skip,
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

    async getFrame(frame: number) {
        const response = await this.request<SharkdGetFrameTreeRequest, SharkdFrameResponse>({
            method: "frame",
            frame: frame,
            proto: true,
            bytes: true
        })

        response.byteRanges = []
        const getByteRanges = (node: SharkdFrameTreeNode) => {
            if (node.n) node.n.map(getByteRanges)
            if (node.h) response.byteRanges.push(node.h)
        }
        response.tree.map(getByteRanges)
        response.byteRanges = uniqWith(response.byteRanges, isEqual)

        return response
    }

    private request<RequestType extends SharkdBaseRequest, ResponseType>(request: RequestType): Promise<ResponseType> {
        return new Promise(async resolve => {
            const release = await this.requestMutex.acquire()
            const socket = await this.socket

            const getRequest = () => {
                return this.jsonRPC2 ?
                    JSON.stringify({ jsonrpc: "2.0", id: 1, method: request.method, params: { ...omit(request, "method") } }) + "\n" :
                    JSON.stringify({ req: request.method, ...omit(request, "method") }) + "\n"
            }

            try {
                socket.write(getRequest())

                socket.pipe(ndjson.parse()).once("data", async response => {
                    socket.removeAllListeners()
                    release()

                    if (this.jsonRPC2) {
                        resolve(response.result)
                    } else {
                        resolve(response)
                    }
                })
            } catch {
                release()
            }
        })
    }
}
