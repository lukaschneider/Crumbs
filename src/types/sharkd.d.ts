interface SharkdLoadFileRequest {
    req: "load"
    file: string
}

interface SharkdGetFramesRequest {
    req: "frames"
    skip: number
    limit: number
    // columnX: number | string
}

interface SharkdGetFrameDetailRequest {
    req: "frame"
    frame: number
    proto: 1
}

interface SharkdFrame {
    /** Values for each column. */
    c: string[]
    /** Frame number. */
    num: number
    /** Background Color in hex. */
    bg: string
    /** Foreground Color in hex. */
    fg: string
}
