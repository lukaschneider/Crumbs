interface SharkdError {
    err: number;
}

interface SharkdRow {
    /** Values for each column. */
    c: string[];
    /** Frame number. */
    num: number;
    /** Background Color in hex */
    bg: string;
    /** Foreground Color in hex */
    fg: string;
}
