import * as ndjson from "ndjson"
import * as vscode from "vscode"
import * as semver from "semver"
import { ChildProcess, spawn, spawnSync } from "child_process"
import { Mutex } from "async-mutex"
import { isEqual, omit, uniqWith } from "lodash"

export default class Document extends vscode.Disposable implements vscode.CustomDocument {
    uri: vscode.Uri

    private disposeEvent = new vscode.EventEmitter<void>()
    private jsonRPC2: boolean
    private process: ChildProcess
    private requestMutex: Mutex

    private createProcess = () => {
        return spawn(this.getSharkdCommand(), ["-"]).on("error", (error) => {
            vscode.window.showErrorMessage(`Could not start sharkd: ${error.message}`)
        })
    }

    private getSharkdCommand = (): string => {
        return vscode.workspace.getConfiguration("crumbs").get("sharkd") || "sharkd"
    }

    private loadFile = async (path: string) => {
        const response = await this.request<SharkdLoadFileRequest, SharkdLoadFileResponse>({ method: "load", file: path })

        // FIXME: With the new jsonRPC 2.0 API there is a seperate result and error response. This "feature" was skipped for now.
        if (response.err === 2) {
            vscode.window.showErrorMessage(`${this.uri.path} does not exist!`)
        }
    }

    private supportsJsonRPC2 = () => {
        const process = spawnSync(this.getSharkdCommand(), ["--version"], { stdio: 'pipe', encoding: 'utf-8' })
        const matches = process.output[1].match(/\d+\.\d+\.\d+/)

        if (matches && matches.length > 0) {
            return semver.gte(matches.pop()!, "3.6.0")
        }
        return false
    }

    constructor(uri: vscode.Uri) {
        super(() => this.dispose())

        this.uri = uri
        this.requestMutex = new Mutex()

        this.jsonRPC2 = this.supportsJsonRPC2()

        this.process = this.createProcess()
        this.loadFile(uri.path)
    }

    async dispose() {
        this.process.kill()
        this.disposeEvent.fire()
    }

    readonly onDispose = this.disposeEvent.event

    async checkFilter(filter: string) {
        const response = await this.request<SharkdCheckFilterRequest, SharkdCheckFilterResponse>({
            method: "check",
            filter: filter
        })

        return {
            ok: response.status == "OK" || response.filter == "ok",
            message: response.message ?? response.filter
        }
    }

    async completeField(field: string) {
        const response = await this.request<SharkdCompleteFieldRequest, SharkdCompleteFieldResponse>({
            method: "complete",
            field: field
        })

        return response.field
    }

    getFrames(columns: ConfigColumn[], skip: number, limit: number, filter: string) {
        return this.request<SharkdGetFramesRequest, SharkdFrame[]>(Object.assign(
            {
                method: "frames",
                skip: skip === 0 ? undefined : skip,
                limit,
                filter
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

            const getRequest = () => {
                return this.jsonRPC2 ?
                    JSON.stringify({ jsonrpc: "2.0", id: 1, method: request.method, params: { ...omit(request, "method") } }) + "\n" :
                    JSON.stringify({ req: request.method, ...omit(request, "method") }) + "\n"
            }

            try {
                this.process.stdin?.write(getRequest(), "utf-8")
                this.process.stdout?.pipe(ndjson.parse()).once("data", async response => {
                    this.process.stdout?.removeAllListeners()
                    release()

                    if (this.jsonRPC2) {
                        resolve(response.result ? response.result : response.error)
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
