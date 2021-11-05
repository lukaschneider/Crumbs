interface FrameHexProps {

}

interface FrameHexState {
    buffer: string
    byteRanges: SharkdByteRange[]
    rowLength: number
    setLength: number
    /** @description byteIndexes which should be highlighted as hovered */
    hoveredRange: number[]
    /** @description byteIndexes which should be highlighted as selected */
    selectedRange: number[]
    enableRowWrap: boolean
}

interface FrameHexField {
    byte?: number
    byteIndex?: number
    fieldIndex: number
    hovered?: boolean
    selected?: boolean
    borderTop?: number
    borderRight?: number
    borderBottom?: number
    borderLeft?: number
}

type FrameHexRows = FrameHexField[][]
