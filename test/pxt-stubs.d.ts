declare class Buffer {
    length: number
    setUint8(off: number, value: number): void
    getUint8(off: number): number
}

declare namespace pins {
    function createBuffer(size: number): Buffer
    function i2cWriteBuffer(address: number, buffer: Buffer, repeat?: boolean): void
    function i2cReadBuffer(address: number, size: number, repeat?: boolean): Buffer
}

declare namespace basic {
    function pause(ms: number): void
}

declare namespace control {
    function millis(): number
}
