class VSCodeApi {
    // @ts-expect-error
    private readonly vscodeApi = acquireVsCodeApi()

    public postMessage(message: any) {
        this.vscodeApi.postMessage(message)
    }
}

export const vscodeApi = new VSCodeApi()