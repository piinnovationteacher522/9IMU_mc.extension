/**
 * DFRobot Gravity SEN0694 9 軸慣性運動感測器（BMI323 + BMM350）。
 *
 * 積木用下拉選單選擇要讀的物理量（加速度、角速度、磁場）和軸（X／Y／Z）。
 * 通訊是 I2C，暫存器位址用 DFRobot 函式庫的 REG_I2C_* 表，
 * 不是 Wiki 上 Modbus／UART 那張表。
 *
 * https://wiki.dfrobot.com.cn/SKU_SEN0694_Gravity_9%E8%BD%B4%E6%83%AF%E6%80%A7%E8%BF%90%E5%8A%A8%E4%BC%A0%E6%84%9F%E5%99%A8
 */
//% color="#E84E0F" weight=90 icon="\uf0b2"
//% block="SEN0694 9軸"
//% groups='["讀取", "設定", "運動偵測"]'
namespace SEN0694 {
    // I2C register map from DFRobot_Multi_DOF_IMU.h (REG_I2C_*).
    const REG_VID = 0x0000
    const REG_PID = 0x0001
    const REG_RESET = 0x0004
    const REG_MODE = 0x0005
    const REG_ACC_RANGE = 0x0006
    const REG_GYR_RANGE = 0x0007
    const REG_INT1 = 0x000C
    const REG_INT2 = 0x000D
    const REG_INT3 = 0x000E
    const REG_ACC_X = 0x0010
    const REG_MAG_X = 0x0016
    const REG_STEP = 0x001E
    const REG_TAP = 0x0020
    const REG_ORIENT = 0x0021

    const VID_DFROBOT = 0x3343
    const PID_9DOF = 0x0009
    const PID_10DOF = 0x0010
    const CACHE_MS = 30

    let deviceAddr = 0x4A
    let connected = false
    let lastProbe = -100000
    let accelRangeG = 8
    let gyroRangeDps = 2000
    let accelCode = 2
    let gyroCode = 4
    let modeCode = 2
    let userSetAccel = false
    let userSetGyro = false
    let userSetMode = false
    let raw6: number[] = [0, 0, 0, 0, 0, 0]
    let raw6At = -100000
    let rawMag: number[] = [0, 0, 0]
    let rawMagAt = -100000

    export enum Quantity {
        //% block="加速度 (g)"
        Acceleration = 0,
        //% block="角速度 (°/s)"
        AngularVelocity = 1,
        //% block="磁場 (µT)"
        MagneticField = 2
    }

    export enum Axis {
        //% block="X 軸"
        X = 0,
        //% block="Y 軸"
        Y = 1,
        //% block="Z 軸"
        Z = 2
    }

    export enum Address {
        //% block="0x4A"
        Addr4A = 0x4A,
        //% block="0x4B"
        Addr4B = 0x4B,
        //% block="0x4C"
        Addr4C = 0x4C,
        //% block="0x4D"
        Addr4D = 0x4D
    }

    export enum Mode {
        //% block="睡眠"
        Sleep = 0,
        //% block="低功耗"
        LowPower = 1,
        //% block="正常"
        Normal = 2,
        //% block="高性能"
        HighPerformance = 3
    }

    export enum AccelRange {
        //% block="±2 g"
        G2 = 0,
        //% block="±4 g"
        G4 = 1,
        //% block="±8 g"
        G8 = 2,
        //% block="±16 g"
        G16 = 3
    }

    export enum GyroRange {
        //% block="±125 °/s"
        Dps125 = 0,
        //% block="±250 °/s"
        Dps250 = 1,
        //% block="±500 °/s"
        Dps500 = 2,
        //% block="±1000 °/s"
        Dps1000 = 3,
        //% block="±2000 °/s"
        Dps2000 = 4
    }

    export enum IntPin {
        //% block="INT1"
        INT1 = 0,
        //% block="INT2"
        INT2 = 1
    }

    export enum IntEvent {
        //% block="關閉"
        Off = 0,
        //% block="資料就緒"
        DataReady = 1,
        //% block="任意運動"
        AnyMotion = 2,
        //% block="靜止"
        NoMotion = 3,
        //% block="顯著運動"
        SignificantMotion = 4,
        //% block="計步"
        Step = 5,
        //% block="平放"
        Flat = 6,
        //% block="方向"
        Orientation = 7,
        //% block="敲擊"
        Tap = 8,
        //% block="傾斜"
        Tilt = 9
    }

    export enum MagInt {
        //% block="關閉"
        Off = 0,
        //% block="資料就緒"
        DataReady = 1
    }

    export enum Tap {
        //% block="無"
        None = 0,
        //% block="單擊"
        Single = 1,
        //% block="雙擊"
        Double = 2,
        //% block="三擊"
        Triple = 3
    }

    export enum Direction {
        //% block="未知"
        Unknown = 0,
        //% block="豎屏正向"
        PortraitUp = 1,
        //% block="橫屏向左"
        LandscapeLeft = 2,
        //% block="橫屏向右"
        LandscapeRight = 3,
        //% block="豎屏倒置"
        PortraitDown = 4
    }

    export enum Face {
        //% block="面向前"
        Forward = 0,
        //% block="面向後"
        Backward = 1,
        //% block="未知"
        Unknown = 2
    }

    // SCALE_START
    function lsbToG(val: number, gRange: number): number {
        return (val * gRange) / 32768
    }

    function lsbToDps(val: number, dpsRange: number): number {
        return (val * dpsRange) / 32768
    }

    function magToUt(raw: number): number {
        return raw * 0.01
    }

    function rangeToG(range: number): number {
        if (range == 1) return 4
        if (range == 2) return 8
        if (range == 3) return 16
        return 2
    }

    function rangeToDps(range: number): number {
        if (range == 0) return 125
        if (range == 1) return 250
        if (range == 2) return 500
        if (range == 3) return 1000
        return 2000
    }

    function decodeU16(lo: number, hi: number): number {
        return (lo & 0xff) | ((hi & 0xff) << 8)
    }

    function decodeI16(lo: number, hi: number): number {
        const v = decodeU16(lo, hi)
        return (v << 16) >> 16
    }

    function decodeI32(b0: number, b1: number, b2: number, b3: number): number {
        return ((b0 & 0xff) | ((b1 & 0xff) << 8) | ((b2 & 0xff) << 16) | ((b3 & 0xff) << 24)) | 0
    }

    function decodeU32(b0: number, b1: number, b2: number, b3: number): number {
        return (b0 & 0xff) + (b1 & 0xff) * 256 + (b2 & 0xff) * 65536 + (b3 & 0xff) * 16777216
    }

    function encodeWrite(reg: number, value: number): number[] {
        return [reg & 0xff, (reg >> 8) & 0xff, value & 0xff, (value >> 8) & 0xff]
    }
    // SCALE_END

    function axisIndex(axis: Axis): number {
        if (axis == Axis.Y) return 1
        if (axis == Axis.Z) return 2
        return 0
    }

    function writeU16(reg: number, value: number): void {
        const bytes = encodeWrite(reg, value)
        const buf = pins.createBuffer(4)
        for (let i = 0; i < 4; i++) {
            buf.setUint8(i, bytes[i])
        }
        pins.i2cWriteBuffer(deviceAddr, buf, false)
    }

    /**
     * Write the 16-bit register address (little-endian), stop, wait for the
     * module firmware, then read. The 10 ms pause matches DFRobot's I2C driver.
     */
    function readBytes(reg: number, len: number): number[] {
        const addr = pins.createBuffer(2)
        addr.setUint8(0, reg & 0xff)
        addr.setUint8(1, (reg >> 8) & 0xff)
        pins.i2cWriteBuffer(deviceAddr, addr, false)
        basic.pause(10)
        const data = pins.i2cReadBuffer(deviceAddr, len, false)
        const out: number[] = []
        if (!data || data.length < len) return out
        for (let i = 0; i < len; i++) {
            out.push(data.getUint8(i))
        }
        return out
    }

    function probeAndConfigure(): void {
        const id = readBytes(REG_VID, 4)
        if (id.length < 4) {
            connected = false
            return
        }
        const vid = decodeU16(id[0], id[1])
        const pid = decodeU16(id[2], id[3])
        if (vid != VID_DFROBOT || (pid != PID_9DOF && pid != PID_10DOF)) {
            connected = false
            return
        }
        connected = true
        applyAccel(userSetAccel ? accelCode : AccelRange.G2)
        applyGyro(userSetGyro ? gyroCode : GyroRange.Dps250)
        applyMode(userSetMode ? modeCode : Mode.Normal)
        basic.pause(20)
    }

    function ensure(): void {
        if (connected) return
        const now = control.millis()
        if (lastProbe >= 0 && now - lastProbe < 500) return
        lastProbe = now
        probeAndConfigure()
    }

    function applyMode(code: number): void {
        writeU16(REG_MODE, code)
        modeCode = code
    }

    function applyAccel(code: number): void {
        writeU16(REG_ACC_RANGE, code)
        accelCode = code
        accelRangeG = rangeToG(code)
        raw6At = -100000
    }

    function applyGyro(code: number): void {
        writeU16(REG_GYR_RANGE, code)
        gyroCode = code
        gyroRangeDps = rangeToDps(code)
        raw6At = -100000
    }

    function refresh6(): void {
        ensure()
        if (!connected) return
        const now = control.millis()
        if (raw6At >= 0 && now - raw6At < CACHE_MS) return
        const b = readBytes(REG_ACC_X, 12)
        if (b.length < 12) return
        for (let i = 0; i < 6; i++) {
            raw6[i] = decodeI16(b[i * 2], b[i * 2 + 1])
        }
        raw6At = control.millis()
    }

    function refreshMag(): void {
        ensure()
        if (!connected) return
        const now = control.millis()
        if (rawMagAt >= 0 && now - rawMagAt < CACHE_MS) return
        const b = readBytes(REG_MAG_X, 12)
        if (b.length < 12) return
        for (let i = 0; i < 3; i++) {
            const o = i * 4
            rawMag[i] = decodeI32(b[o], b[o + 1], b[o + 2], b[o + 3])
        }
        rawMagAt = control.millis()
    }

    /**
     * 讀取一個軸的加速度、角速度或磁場。
     * 加速度單位 g，角速度單位 °/s，磁場單位 µT。
     */
    //% blockId=sen0694_read
    //% block="讀取 %quantity 的 %axis"
    //% quantity.defl=SEN0694.Quantity.Acceleration
    //% axis.defl=SEN0694.Axis.X
    //% group="讀取"
    //% weight=100
    //% inlineInputMode=inline
    export function read(quantity: Quantity, axis: Axis): number {
        const index = axisIndex(axis)
        if (quantity == Quantity.MagneticField) {
            refreshMag()
            if (!connected) return 0
            return magToUt(rawMag[index])
        }
        refresh6()
        if (!connected) return 0
        if (quantity == Quantity.AngularVelocity) {
            return lsbToDps(raw6[3 + index], gyroRangeDps)
        }
        return lsbToG(raw6[index], accelRangeG)
    }

    /**
     * 以指定的 I2C 地址啟動感測器。
     * 未呼叫時，第一次讀取會用 0x4A 自動啟動。
     * 啟動後若沒另外設定，工作模式為正常、加速度 ±2 g、陀螺儀 ±250 °/s。
     */
    //% blockId=sen0694_begin
    //% block="初始化 SEN0694 地址 %address"
    //% address.defl=SEN0694.Address.Addr4A
    //% group="設定"
    //% weight=90
    //% inlineInputMode=inline
    export function begin(address: Address): void {
        deviceAddr = address
        connected = false
        raw6At = -100000
        rawMagAt = -100000
        lastProbe = control.millis()
        probeAndConfigure()
    }

    /**
     * 設定工作模式。睡眠時感測器停止量測。
     */
    //% blockId=sen0694_set_mode
    //% block="設定工作模式為 %mode"
    //% mode.defl=SEN0694.Mode.Normal
    //% group="設定"
    //% weight=80
    //% inlineInputMode=inline
    export function setMode(mode: Mode): void {
        userSetMode = true
        modeCode = mode
        if (connected) {
            applyMode(mode)
            basic.pause(20)
        }
    }

    /**
     * 設定加速度計量程。量程愈小，小動作愈靈敏。
     */
    //% blockId=sen0694_set_accel_range
    //% block="設定加速度量程為 %range"
    //% range.defl=SEN0694.AccelRange.G2
    //% group="設定"
    //% weight=70
    //% inlineInputMode=inline
    export function setAccelRange(range: AccelRange): void {
        userSetAccel = true
        accelCode = range
        accelRangeG = rangeToG(range)
        raw6At = -100000
        if (connected) {
            applyAccel(range)
            basic.pause(20)
        }
    }

    /**
     * 設定陀螺儀量程。量程愈小，慢速轉動愈靈敏。
     */
    //% blockId=sen0694_set_gyro_range
    //% block="設定陀螺儀量程為 %range"
    //% range.defl=SEN0694.GyroRange.Dps250
    //% group="設定"
    //% weight=60
    //% inlineInputMode=inline
    export function setGyroRange(range: GyroRange): void {
        userSetGyro = true
        gyroCode = range
        gyroRangeDps = rangeToDps(range)
        raw6At = -100000
        if (connected) {
            applyGyro(range)
            basic.pause(20)
        }
    }

    /**
     * 感測器是否已回應 DFRobot 廠商代碼與 9 軸（或 10 軸）產品代碼。
     */
    //% blockId=sen0694_connected
    //% block="SEN0694 已連線"
    //% group="設定"
    //% weight=50
    export function isConnected(): boolean {
        ensure()
        return connected
    }

    /**
     * 恢復出廠設定。加速度回到 ±8 g，陀螺儀回到 ±2000 °/s，模式回到正常。
     */
    //% blockId=sen0694_reset
    //% block="恢復 SEN0694 出廠設定"
    //% group="設定"
    //% weight=40
    //% advanced=true
    export function reset(): void {
        ensure()
        if (connected) {
            writeU16(REG_RESET, 0x0001)
            basic.pause(50)
        }
        userSetAccel = false
        userSetGyro = false
        userSetMode = false
        accelCode = AccelRange.G8
        gyroCode = GyroRange.Dps2000
        modeCode = Mode.Normal
        accelRangeG = 8
        gyroRangeDps = 2000
        raw6At = -100000
        rawMagAt = -100000
    }

    /**
     * 設定 INT1 或 INT2。計步、敲擊、方向要先選對應功能，輪詢讀數才會更新。
     * 不必把 INT 腳接到 micro:bit。
     */
    //% blockId=sen0694_set_int
    //% block="設定 %pin 為 %event"
    //% pin.defl=SEN0694.IntPin.INT1
    //% event.defl=SEN0694.IntEvent.Off
    //% group="運動偵測"
    //% weight=30
    //% inlineInputMode=inline
    export function setInterrupt(pin: IntPin, event: IntEvent): void {
        ensure()
        if (!connected) return
        const reg = pin == IntPin.INT2 ? REG_INT2 : REG_INT1
        writeU16(reg, event)
    }

    /**
     * 設定磁力計中斷 INT3。INT3 只支援關閉或資料就緒。
     */
    //% blockId=sen0694_set_int3
    //% block="設定 INT3 為 %event"
    //% event.defl=SEN0694.MagInt.Off
    //% group="運動偵測"
    //% weight=20
    //% inlineInputMode=inline
    export function setMagInterrupt(event: MagInt): void {
        ensure()
        if (!connected) return
        writeU16(REG_INT3, event)
    }

    /**
     * 累計步數。請先把 INT1 或 INT2 設為計步。
     */
    //% blockId=sen0694_steps
    //% block="步數"
    //% group="運動偵測"
    //% weight=10
    export function stepCount(): number {
        ensure()
        if (!connected) return 0
        const b = readBytes(REG_STEP, 4)
        if (b.length < 4) return 0
        return decodeU32(b[0], b[1], b[2], b[3])
    }

    /**
     * 最近一次敲擊。請先把 INT1 或 INT2 設為敲擊。
     */
    //% blockId=sen0694_tap
    //% block="敲擊"
    //% group="運動偵測"
    //% weight=9
    export function tap(): Tap {
        ensure()
        if (!connected) return Tap.None
        const b = readBytes(REG_TAP, 2)
        if (b.length < 2) return Tap.None
        const v = decodeU16(b[0], b[1])
        if (v == Tap.Single) return Tap.Single
        if (v == Tap.Double) return Tap.Double
        if (v == Tap.Triple) return Tap.Triple
        return Tap.None
    }

    /**
     * 直立或橫放。請先把 INT1 或 INT2 設為方向。
     */
    //% blockId=sen0694_direction
    //% block="放置方向"
    //% group="運動偵測"
    //% weight=8
    export function direction(): Direction {
        ensure()
        if (!connected) return Direction.Unknown
        const b = readBytes(REG_ORIENT, 2)
        if (b.length < 2) return Direction.Unknown
        const v = b[1]
        if (v == Direction.PortraitUp) return Direction.PortraitUp
        if (v == Direction.LandscapeLeft) return Direction.LandscapeLeft
        if (v == Direction.LandscapeRight) return Direction.LandscapeRight
        if (v == Direction.PortraitDown) return Direction.PortraitDown
        return Direction.Unknown
    }

    /**
     * 正面朝前或朝後。請先把 INT1 或 INT2 設為方向。
     */
    //% blockId=sen0694_face
    //% block="正反面"
    //% group="運動偵測"
    //% weight=7
    export function face(): Face {
        ensure()
        if (!connected) return Face.Unknown
        const b = readBytes(REG_ORIENT, 2)
        if (b.length < 2) return Face.Unknown
        if (b[0] == Face.Backward) return Face.Backward
        if (b[0] == Face.Forward) return Face.Forward
        return Face.Unknown
    }
}
