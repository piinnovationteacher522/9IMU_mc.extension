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
//% groups='["讀取", "空氣鼓", "設定", "運動偵測"]'
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
    let i2cLock = false
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
    let headingReference = 0
    let gravX = 0
    let gravY = 0
    let gravZ = 0
    let gravReady = 0
    let integratedAt = -1
    let magUsedAt = -1
    let stableHeadingValue = -1
    let levelOffset = 0
    let tipRateDps = 0
    let strikeThreshold = 220
    let strikeInStroke = 0
    let strikePeak = 0
    let strikeSpeedDps = 0
    let strikeLatched = false
    let strikeWatching = false
    let magSkip = 0
    const STRIKE_SRC = 55094
    const STRIKE_EVT = 1

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

    /**
     * Magnetic heading of the board +X axis, degrees clockwise from magnetic
     * north when viewed from above. Returns -1 when +X is nearly vertical or
     * the horizontal magnetic field is too small to trust.
     * The accelerometer vector is treated as "up", so the SEN0694 face-up
     * reading of about -1 g on Z does not need a separate axis flip.
     */
    function headingDegrees(ax: number, ay: number, az: number, mx: number, my: number, mz: number): number {
        const an = Math.sqrt(ax * ax + ay * ay + az * az)
        const mn = Math.sqrt(mx * mx + my * my + mz * mz)
        if (an < 1e-6 || mn < 1e-6) return -1
        const ux = ax / an
        const uy = ay / an
        const uz = az / an
        const align = mx * ux + my * uy + mz * uz
        const nx = mx - ux * align
        const ny = my - uy * align
        const nz = mz - uz * align
        const nn = Math.sqrt(nx * nx + ny * ny + nz * nz)
        const fx = 1 - ux * ux
        const fy = -uy * ux
        const fz = -uz * ux
        const fn = Math.sqrt(fx * fx + fy * fy + fz * fz)
        if (nn < mn * 0.05 || fn < 0.2) return -1
        const cx = ny * fz - nz * fy
        const cy = nz * fx - nx * fz
        const cz = nx * fy - ny * fx
        const sinTerm = -(ux * cx + uy * cy + uz * cz)
        const cosTerm = nx * fx + ny * fy + nz * fz
        let deg = Math.atan2(sinTerm, cosTerm) * (180 / Math.PI)
        if (deg < 0) deg += 360
        return deg
    }

    /** Signed shortest turn from reference to current: right is positive, left is negative. */
    function relativeDegrees(current: number, reference: number): number {
        if (current < 0 || reference < 0) return -1
        let delta = current - reference
        while (delta > 180) delta -= 360
        while (delta < -180) delta += 360
        return delta
    }

    /**
     * Tilt-compensated heading that ignores a knock.
     * A sample is trusted only when trustAccel is non-zero and the vector
     * length is near 1 g. Untrusted samples do not pull the gravity estimate;
     * gyro (degrees/second) still rotates it, so a twist during the hit is kept.
     * Returns [heading, gravityX, gravityY, gravityZ, ready].
     */
    function trackHeading(
        ax: number, ay: number, az: number,
        wx: number, wy: number, wz: number,
        mx: number, my: number, mz: number,
        dt: number,
        sx: number, sy: number, sz: number,
        ready: number,
        trustAccel: number,
        lastHeading: number
    ): number[] {
        const an = Math.sqrt(ax * ax + ay * ay + az * az)
        const trusted = trustAccel != 0 && an > 0.65 && an < 1.45
        if (!ready) {
            if (!trusted) return [-1, sx, sy, sz, 0]
            return [headingDegrees(ax, ay, az, mx, my, mz), ax, ay, az, 1]
        }
        if (dt < 0) dt = 0
        if (dt > 0.1) {
            if (trusted) {
                sx = ax
                sy = ay
                sz = az
            }
            dt = 0
        }
        if (dt > 0) {
            const scale = Math.PI / 180
            const ox = wx * scale
            const oy = wy * scale
            const oz = wz * scale
            const cx = oy * sz - oz * sy
            const cy = oz * sx - ox * sz
            const cz = ox * sy - oy * sx
            sx -= cx * dt
            sy -= cy * dt
            sz -= cz * dt
        }
        if (trusted && dt > 0) {
            const blend = 0.25
            sx = sx * (1 - blend) + ax * blend
            sy = sy * (1 - blend) + ay * blend
            sz = sz * (1 - blend) + az * blend
        }
        const sn = Math.sqrt(sx * sx + sy * sy + sz * sz)
        if (sn < 1e-6) return [-1, 0, 0, 0, 0]
        sx /= sn
        sy /= sn
        sz /= sn
        let deg = headingDegrees(sx, sy, sz, mx, my, mz)
        if (deg < 0 && !trusted && lastHeading >= 0) deg = lastHeading
        return [deg, sx, sy, sz, 1]
    }

    function clampUnit(value: number): number {
        if (value > 1) return 1
        if (value < -1) return -1
        return value
    }

    /** Tip-up angle of +X, in degrees. ux, uy, uz is a unit up vector. */
    function elevationDegrees(ux: number, uy: number, uz: number): number {
        return Math.asin(clampUnit(ux)) * (180 / Math.PI)
    }

    /**
     * How fast that tip-up angle is changing, in degrees/second.
     * Positive means the tip is rising. Angular rates are degrees/second.
     */
    function elevationRateDps(ux: number, uy: number, uz: number, wy: number, wz: number): number {
        const s = clampUnit(ux)
        const cosE = Math.sqrt(Math.max(0, 1 - s * s))
        const denom = cosE < 0.25 ? 0.25 : cosE
        const scale = Math.PI / 180
        const oy = wy * scale
        const oz = wz * scale
        const ds = -oy * uz + oz * uy
        return (ds / denom) / scale
    }

    /** Tip height above the grip. Positive is above the hand, negative is below. */
    function tipHeightCm(lengthCm: number, elevationDeg: number): number {
        return lengthCm * Math.sin(elevationDeg * Math.PI / 180)
    }

    /**
     * One air-drum stroke. downDps is how fast the tip is falling.
     * The hit is reported when that fall slows back down, which is the bottom of the swing.
     * Returns [fired, inStroke, peak, speed].
     */
    function nextStrike(downDps: number, threshold: number, inStroke: number, peak: number): number[] {
        if (downDps < 0) downDps = 0
        if (threshold < 1) threshold = 1
        if (!inStroke) {
            if (downDps >= threshold) return [0, 1, downDps, 0]
            return [0, 0, 0, 0]
        }
        if (downDps > peak) peak = downDps
        if (downDps < threshold * 0.5) return [1, 0, 0, peak]
        return [0, 1, peak, 0]
    }

    /** Front-half zones: 0 unknown, 1 left, 2 center, 3 right. */
    function drumZone(relative: number): number {
        if (relative < -180 || relative > 180) return 0
        if (relative < -25) return 1
        if (relative > 25) return 3
        return 2
    }
    // SCALE_END

    function axisIndex(axis: Axis): number {
        if (axis == Axis.Y) return 1
        if (axis == Axis.Z) return 2
        return 0
    }

    function writeU16(reg: number, value: number): void {
        while (i2cLock) basic.pause(1)
        i2cLock = true
        const bytes = encodeWrite(reg, value)
        const buf = pins.createBuffer(4)
        for (let i = 0; i < 4; i++) {
            buf.setUint8(i, bytes[i])
        }
        pins.i2cWriteBuffer(deviceAddr, buf, false)
        i2cLock = false
    }

    /**
     * Write the 16-bit register address (little-endian), stop, wait for the
     * module firmware, then read. The 10 ms pause matches DFRobot's I2C driver.
     */
    function readBytes(reg: number, len: number): number[] {
        while (i2cLock) basic.pause(1)
        i2cLock = true
        const addr = pins.createBuffer(2)
        addr.setUint8(0, reg & 0xff)
        addr.setUint8(1, (reg >> 8) & 0xff)
        pins.i2cWriteBuffer(deviceAddr, addr, false)
        basic.pause(10)
        const data = pins.i2cReadBuffer(deviceAddr, len, false)
        i2cLock = false
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

    function clearHeadingState(): void {
        gravX = 0
        gravY = 0
        gravZ = 0
        gravReady = 0
        integratedAt = -1
        magUsedAt = -1
        stableHeadingValue = -1
        tipRateDps = 0
    }

    function ensureDrumRanges(): void {
        if (!userSetGyro && gyroRangeDps != 2000) {
            userSetGyro = true
            gyroCode = GyroRange.Dps2000
            gyroRangeDps = 2000
            if (connected) applyGyro(GyroRange.Dps2000)
        }
        if (!userSetAccel && accelRangeG < 8) {
            userSetAccel = true
            accelCode = AccelRange.G8
            accelRangeG = 8
            if (connected) applyAccel(AccelRange.G8)
        }
    }

    function updateMotion(wantMag: boolean): void {
        refresh6()
        if (wantMag) refreshMag()
        if (!connected) {
            clearHeadingState()
            return
        }
        const ax = lsbToG(raw6[0], accelRangeG)
        const ay = lsbToG(raw6[1], accelRangeG)
        const az = lsbToG(raw6[2], accelRangeG)
        const mx = magToUt(rawMag[0])
        const my = magToUt(rawMag[1])
        const mz = magToUt(rawMag[2])
        const wxRaw = lsbToDps(raw6[3], gyroRangeDps)
        const wyRaw = lsbToDps(raw6[4], gyroRangeDps)
        const wzRaw = lsbToDps(raw6[5], gyroRangeDps)
        if (integratedAt == raw6At) {
            if (wantMag && magUsedAt != rawMagAt && gravReady) {
                const held = stableHeadingValue
                stableHeadingValue = headingDegrees(gravX, gravY, gravZ, mx, my, mz)
                if (stableHeadingValue < 0 && held >= 0) stableHeadingValue = held
                magUsedAt = rawMagAt
            }
            return
        }
        let dt = 0.05
        if (integratedAt >= 0) dt = (raw6At - integratedAt) / 1000
        integratedAt = raw6At
        magUsedAt = rawMagAt
        let wx = wxRaw
        let wy = wyRaw
        let wz = wzRaw
        const limit = gyroRangeDps * 0.95
        if (Math.abs(wx) >= limit || Math.abs(wy) >= limit || Math.abs(wz) >= limit) {
            wx = 0
            wy = 0
            wz = 0
        }
        const clipped = Math.abs(raw6[0]) > 32000 || Math.abs(raw6[1]) > 32000 || Math.abs(raw6[2]) > 32000
        const tracked = trackHeading(
            ax, ay, az, wx, wy, wz, mx, my, mz, dt,
            gravX, gravY, gravZ, gravReady, clipped ? 0 : 1, stableHeadingValue
        )
        stableHeadingValue = tracked[0]
        gravX = tracked[1]
        gravY = tracked[2]
        gravZ = tracked[3]
        gravReady = tracked[4]
        if (!gravReady) {
            tipRateDps = 0
            return
        }
        tipRateDps = elevationRateDps(gravX, gravY, gravZ, wyRaw, wzRaw)
        const elev = elevationDegrees(gravX, gravY, gravZ)
        if (elev <= -75 || elev >= 75) return
        const down = tipRateDps < 0 ? -tipRateDps : 0
        const step = nextStrike(down, strikeThreshold, strikeInStroke, strikePeak)
        strikeInStroke = step[1]
        strikePeak = step[2]
        if (step[0]) {
            strikeSpeedDps = step[3]
            strikeLatched = true
            if (strikeWatching) control.raiseEvent(STRIKE_SRC, STRIKE_EVT)
        }
    }

    /**
     * 模組 +X 軸目前的磁方位角，0 到 360 度。
     * 0 表示 +X 指向磁北，90 表示指向磁東，順時針增加。
     * 從正上方往下看。平放或傾斜都可以；+X 幾乎朝天或朝地時回傳 -1。
     * 敲擊時加速度會突然偏離 1 g，這一筆不用來判斷傾斜，方向仍連續。
     * 敲擊同時轉動時，用陀螺儀把傾斜方向補上。
     * 這是磁北，不是地圖上的真北。附近的鐵或磁鐵會使角度偏移。
     */
    //% blockId=sen0694_heading
    //% block="面向角度"
    //% group="讀取"
    //% weight=96
    export function heading(): number {
        updateMotion(true)
        return stableHeadingValue
    }

    /**
     * 把此刻的面向角度記成 0 度。
     * 之後相對角度以這個方向為準：向右為正，向左為負。
     * 讀不到面向角度時，原本的 0 度方向保持不變。
     */
    //% blockId=sen0694_set_heading_zero
    //% block="將目前方向設為 0 度"
    //% group="設定"
    //% weight=85
    export function setHeadingZero(): void {
        const now = heading()
        if (now < 0) return
        headingReference = now
    }

    /**
     * 相對上次歸零方向的角度。
     * 向右 0 到 180 度，向左 0 到 -180 度。正後方為 180 或 -180。
     * 尚未歸零時，0 度是磁北。讀不到方向時回傳 -1。
     */
    //% blockId=sen0694_relative_heading
    //% block="相對角度"
    //% group="讀取"
    //% weight=95
    export function relativeHeading(): number {
        return relativeDegrees(heading(), headingReference)
    }

    export enum Drum {
        //% block="未知"
        Unknown = 0,
        //% block="左"
        Left = 1,
        //% block="中"
        Center = 2,
        //% block="右"
        Right = 3
    }

    /**
     * 鼓棍 +X 軸抬離水平面的角度。
     * 棍頭朝上為正，最大 90；朝下為負，最小 -90；水平為 0。
     * 把模組 +X 指向棍頭。抬高棍頭時這個角度應變大。
     */
    //% blockId=sen0694_elevation
    //% block="鼓棍仰角"
    //% group="空氣鼓"
    //% weight=80
    export function stickElevation(): number {
        ensureDrumRanges()
        updateMotion(false)
        if (!gravReady) return 0
        let deg = elevationDegrees(gravX, gravY, gravZ) - levelOffset
        while (deg > 180) deg -= 360
        while (deg < -180) deg += 360
        return deg
    }

    /**
     * 棍頭相對手握處的高度，單位公分。
     * 水平為 0，高過手腕為正，低過手腕為負。
     * 這是手腕當支點、棍長固定時的高度，不是離地面的高度。
     */
    //% blockId=sen0694_tip_height
    //% block="棍頭高度 (cm) 棍長 %length"
    //% length.defl=32
    //% length.min=5
    //% length.max=80
    //% group="空氣鼓"
    //% weight=70
    //% inlineInputMode=inline
    export function tipHeight(length: number): number {
        return tipHeightCm(length, stickElevation())
    }

    /**
     * 棍頭上下揮的角速度，單位 °/s。
     * 正數是向上，負數是向下打。
     */
    //% blockId=sen0694_tip_rate
    //% block="棍頭角速度"
    //% group="空氣鼓"
    //% weight=85
    export function tipRate(): number {
        ensureDrumRanges()
        updateMotion(false)
        return tipRateDps
    }

    /**
     * 以相對角度分成左、中、右三面鼓。
     * 先把鼓棍指向中間那面鼓，再執行「將目前方向設為 0 度」。
     * 偏左超過 25 度是左，偏右超過 25 度是右。讀不到方向時是未知。
     */
    //% blockId=sen0694_drum
    //% block="鼓位"
    //% group="空氣鼓"
    //% weight=60
    export function drum(): Drum {
        ensureDrumRanges()
        const bearing = heading()
        if (bearing < 0) return Drum.Unknown
        const zone = drumZone(relativeDegrees(bearing, headingReference))
        if (zone == 1) return Drum.Left
        if (zone == 3) return Drum.Right
        if (zone == 2) return Drum.Center
        return Drum.Unknown
    }

    /**
     * 一次向下揮棍，並在揮勢慢下來時成立，約是落到鼓面的時刻。
     * 每次打擊只會成立一次，讀走之後變回假，直到下一擊。
     */
    //% blockId=sen0694_was_struck
    //% block="發生打擊"
    //% group="空氣鼓"
    //% weight=95
    export function wasStruck(): boolean {
        ensureDrumRanges()
        updateMotion(false)
        if (!strikeLatched) return false
        strikeLatched = false
        return true
    }

    /**
     * 最近一次打擊裡，棍頭向下的最快角速度，單位 °/s。
     * 可用來決定音量。還沒打過是 0。
     */
    //% blockId=sen0694_strike_speed
    //% block="這次打擊速度 (°/s)"
    //% group="空氣鼓"
    //% weight=90
    export function strikeSpeed(): number {
        ensureDrumRanges()
        updateMotion(false)
        return strikeSpeedDps
    }

    /**
     * 向下揮棍並在最低點附近執行。
     * 裡面用「鼓位」選鼓，「這次打擊速度」調音量，「棍頭高度」忽略揮在鼓面上方的空揮。
     */
    //% blockId=sen0694_on_strike
    //% block="當鼓棍打擊時"
    //% group="空氣鼓"
    //% weight=100
    export function onStrike(handler: () => void): void {
        control.onEvent(STRIKE_SRC, STRIKE_EVT, handler)
        if (strikeWatching) return
        strikeWatching = true
        control.inBackground(function () {
            while (true) {
                ensureDrumRanges()
                magSkip++
                updateMotion(magSkip >= 4)
                if (magSkip >= 4) magSkip = 0
                basic.pause(15)
            }
        })
    }

    /**
     * 把此刻的鼓棍仰角記成水平。
     * 模組若沒有完全貼平鼓棍，先把鼓棍拿成你要的水平，再執行這塊。
     */
    //% blockId=sen0694_set_level
    //% block="將目前姿勢設為水平"
    //% group="空氣鼓"
    //% weight=50
    export function setStickLevel(): void {
        ensureDrumRanges()
        levelOffset = 0
        levelOffset = stickElevation()
    }

    /**
     * 棍頭向下的角速度超過這個值，才開始算一次打擊。
     * 預設 220 °/s。輕敲抓不到就調低，走路也會觸發就調高。
     */
    //% blockId=sen0694_strike_threshold
    //% block="設定打擊門檻為 %speed °/s"
    //% speed.defl=220
    //% speed.min=40
    //% speed.max=1800
    //% group="空氣鼓"
    //% weight=40
    //% inlineInputMode=inline
    export function setStrikeThreshold(speed: number): void {
        if (speed < 1) speed = 1
        strikeThreshold = speed
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
        clearHeadingState()
        levelOffset = 0
        strikeInStroke = 0
        strikePeak = 0
        strikeLatched = false
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
        clearHeadingState()
        levelOffset = 0
        strikeInStroke = 0
        strikePeak = 0
        strikeLatched = false
        strikeThreshold = 220
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
