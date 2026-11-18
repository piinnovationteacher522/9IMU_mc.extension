import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const root = new URL("../", import.meta.url)
const src = fs.readFileSync(new URL("sen0694.ts", root), "utf8")

function loadScale() {
    const start = src.indexOf("// SCALE_START")
    const end = src.indexOf("// SCALE_END")
    assert.ok(start >= 0 && end > start, "scale region markers")
    let slice = src.slice(start, end)
    slice = slice.replace(/:\s*number\[\]/g, "").replace(/:\s*number/g, "")
    return new Function(
        `${slice}\nreturn { lsbToG, lsbToDps, magToUt, decodeU16, decodeI16, decodeI32, decodeU32, encodeWrite, rangeToG, rangeToDps, headingDegrees, relativeDegrees, trackHeading, elevationDegrees, elevationRateDps, tipHeightCm, nextStrike, drumZone };`
    )()
}

function closeTo(actual, expected) {
    assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`)
}

const fns = loadScale()

test("accelerometer scale matches the SEN0694 sensitivity table", () => {
    const lsbPerG = { 0: 16384, 1: 8192, 2: 4096, 3: 2048 }
    for (const code of [0, 1, 2, 3]) {
        const g = fns.rangeToG(code)
        assert.equal(32768 / g, lsbPerG[code])
        closeTo(fns.lsbToG(lsbPerG[code], g), 1)
        closeTo(fns.lsbToG(-lsbPerG[code], g), -1)
    }
})

test("wiki sample words convert at the ±8 g sensitivity", () => {
    // Modbus shows the register word big-endian. I2C delivers that word
    // little-endian, so the first byte is the low byte.
    // FF DD is -35. The wiki text says -43, which does not match the hex.
    const words = [
        [0xad, 0xff, -83],
        [0xdd, 0xff, -35],
        [0xe1, 0xef, -4127]
    ]
    words.forEach(([lo, hi, signed]) => {
        assert.equal(fns.decodeI16(lo, hi), signed)
        closeTo(fns.lsbToG(signed, 8), signed / 4096)
    })
})

test("gyroscope scale matches the sensitivity table", () => {
    const lsbPerDps = {
        0: 262.144,
        1: 131.072,
        2: 65.536,
        3: 32.768,
        4: 16.384
    }
    for (const code of [0, 1, 2, 3, 4]) {
        const dps = fns.rangeToDps(code)
        closeTo(32768 / dps, lsbPerDps[code])
        closeTo(fns.lsbToDps(32768 / dps, dps), 1)
    }
    closeTo(fns.lsbToDps(0, 250), 0)
    closeTo(fns.lsbToDps(131, 250), (131 * 250) / 32768)
})

test("magnetometer int32 is scaled by 0.01 µT", () => {
    assert.equal(fns.decodeI32(0xc4, 0x09, 0x00, 0x00), 2500)
    closeTo(fns.magToUt(2500), 25)
    assert.equal(fns.decodeI32(0x3c, 0xf6, 0xff, 0xff), -2500)
    closeTo(fns.magToUt(-2500), -25)
    closeTo(fns.magToUt(0), 0)
})

test("16-bit sign extension and DFRobot id words", () => {
    assert.equal(fns.decodeI16(0xff, 0x7f), 32767)
    assert.equal(fns.decodeI16(0x00, 0x80), -32768)
    assert.equal(fns.decodeI16(0x00, 0x00), 0)
    assert.equal(fns.decodeU16(0x43, 0x33), 0x3343)
    assert.equal(fns.decodeU16(0x09, 0x00), 0x0009)
    assert.equal(fns.decodeU16(0x10, 0x00), 0x0010)
})

test("step counter is an unsigned little-endian 32-bit word", () => {
    assert.equal(fns.decodeU32(0x34, 0x12, 0x00, 0x00), 0x1234)
    assert.equal(fns.decodeU32(0x00, 0x00, 0x01, 0x00), 65536)
    assert.equal(fns.decodeU32(0xff, 0xff, 0xff, 0xff), 0xffffffff)
})

test("I2C register addresses are the REG_I2C map, not the Modbus map", () => {
    const reg = (name) => {
        const matched = src.match(new RegExp(`const ${name} = (0x[0-9A-Fa-f]+)`))
        assert.ok(matched, name)
        return Number(matched[1])
    }
    assert.equal(reg("REG_VID"), 0x0000)
    assert.equal(reg("REG_PID"), 0x0001)
    assert.equal(reg("REG_RESET"), 0x0004)
    assert.equal(reg("REG_MODE"), 0x0005)
    assert.equal(reg("REG_ACC_RANGE"), 0x0006)
    assert.equal(reg("REG_GYR_RANGE"), 0x0007)
    assert.equal(reg("REG_INT1"), 0x000c)
    assert.equal(reg("REG_INT2"), 0x000d)
    assert.equal(reg("REG_INT3"), 0x000e)
    assert.equal(reg("REG_ACC_X"), 0x0010)
    assert.equal(reg("REG_MAG_X"), 0x0016)
    assert.equal(reg("REG_STEP"), 0x001e)
    assert.equal(reg("REG_TAP"), 0x0020)
    assert.equal(reg("REG_ORIENT"), 0x0021)
    assert.match(src, /VID_DFROBOT = 0x3343/)
    assert.match(src, /PID_9DOF = 0x0009/)
    assert.match(src, /PID_10DOF = 0x0010/)
})

test("range writes are little-endian register plus value", () => {
    assert.deepEqual(fns.encodeWrite(0x0006, 0), [0x06, 0x00, 0x00, 0x00])
    assert.deepEqual(fns.encodeWrite(0x0006, 3), [0x06, 0x00, 0x03, 0x00])
    assert.deepEqual(fns.encodeWrite(0x0007, 1), [0x07, 0x00, 0x01, 0x00])
    assert.deepEqual(fns.encodeWrite(0x0005, 2), [0x05, 0x00, 0x02, 0x00])
    assert.deepEqual(fns.encodeWrite(0x0004, 1), [0x04, 0x00, 0x01, 0x00])
    assert.deepEqual(fns.encodeWrite(0x0010, 0).slice(0, 2), [0x10, 0x00])
})

function closeAngle(actual, expected) {
    const delta = Math.abs(((actual - expected + 540) % 360) - 180)
    assert.ok(delta < 0.05, `${actual} != ${expected}`)
}

test("heading is the clockwise angle of +X from magnetic north", () => {
    // Face up on this module: Z about -1 g. Level, +X north.
    closeAngle(fns.headingDegrees(0, 0, -1, 40, 0, 15), 0)
    closeAngle(fns.headingDegrees(0, 0, -1, 0, -40, 15), 90)
    closeAngle(fns.headingDegrees(0, 0, -1, -40, 0, 15), 180)
    closeAngle(fns.headingDegrees(0, 0, -1, 0, 40, 15), 270)
    // Face down still reports the same +X heading.
    closeAngle(fns.headingDegrees(0, 0, 1, 0, 40, -15), 90)
    // Nose-up pitch must not change a north heading.
    const c = Math.cos(Math.PI / 6)
    const s = -0.5
    closeAngle(fns.headingDegrees(0.5, 0, -c, c + s * 0.5, 0, -s + c * 0.5), 0)
})

test("relative angle is right-positive and left-negative from the set-zero heading", () => {
    assert.equal(fns.relativeDegrees(10, 0), 10)
    assert.equal(fns.relativeDegrees(350, 0), -10)
    assert.equal(fns.relativeDegrees(180, 0), 180)
    assert.equal(fns.relativeDegrees(0, 180), -180)
    assert.equal(fns.relativeDegrees(0, 90), -90)
    assert.equal(fns.relativeDegrees(180, 90), 90)
    assert.equal(fns.relativeDegrees(0, 270), 90)
    assert.equal(fns.relativeDegrees(100, 100), 0)
    assert.equal(fns.relativeDegrees(10, 200), 170)
    assert.equal(fns.relativeDegrees(-1, 20), -1)
    assert.equal(fns.relativeDegrees(20, -1), -1)
})

test("a knock does not drag the heading, and gyro keeps a tilt that happens during it", () => {
    let state = fns.trackHeading(0, 0, -1, 0, 0, 0, 40, 0, 15, 0.05, 0, 0, 0, 0, 1, -1)
    closeAngle(state[0], 0)

    const knocked = fns.trackHeading(0, 3, -1, 0, 0, 0, 40, 0, 15, 0.05, state[1], state[2], state[3], state[4], 1, state[0])
    closeAngle(knocked[0], 0)
    const raw = fns.headingDegrees(0, 3, -1, 40, 0, 15)
    assert.ok(raw < 0 || Math.abs(((raw - 0 + 540) % 360) - 180) > 15, `raw heading ${raw} should leave north`)

    // 10 degrees of pitch at 100 °/s while the accelerometer is still knocked.
    // Magnetometer is rotated with the same body rate; heading stays north.
    const wy = 100
    const dt = 0.1
    const oy = wy * Math.PI / 180
    const mx = 40
    const mz = 15
    const magX = mx - (oy * mz) * dt
    const magZ = mz - (-oy * mx) * dt
    const pitched = fns.trackHeading(0, 3, -1, 0, wy, 0, magX, 0, magZ, dt, knocked[1], knocked[2], knocked[3], knocked[4], 1, knocked[0])
    closeAngle(pitched[0], 0)
    assert.ok(pitched[1] > 0.1, `gravity should pitch toward +X, got ${pitched[1]}`)
})

test("stick elevation, tip height, and downward rate follow the +X axis", () => {
    closeTo(fns.elevationDegrees(0, 0, -1), 0)
    closeTo(fns.elevationDegrees(1, 0, 0), 90)
    closeTo(fns.elevationDegrees(-1, 0, 0), -90)
    closeTo(fns.elevationDegrees(0.5, 0, -Math.sqrt(0.75)), 30)
    closeTo(fns.tipHeightCm(32, 0), 0)
    closeTo(fns.tipHeightCm(32, 30), 16)
    closeTo(fns.tipHeightCm(32, 90), 32)
    closeTo(fns.elevationRateDps(0, 0, -1, 100, 0), 100)
    closeTo(fns.elevationRateDps(0, 0, -1, -240, 0), -240)
    closeTo(fns.elevationRateDps(0, 0, -1, 0, 300), 0)
})

test("a strike fires once, at the bottom of the downswing", () => {
    let stroke = 0
    let peak = 0
    let fires = 0
    let speed = 0
    for (const down of [0, 100, 250, 400, 180, 50, 50]) {
        const step = fns.nextStrike(down, 220, stroke, peak)
        stroke = step[1]
        peak = step[2]
        if (step[0]) {
            fires++
            speed = step[3]
        }
    }
    assert.equal(fires, 1)
    assert.equal(stroke, 0)
    assert.equal(speed, 400)
    const again = fns.nextStrike(50, 220, stroke, peak)
    assert.equal(again[0], 0)
})

test("drum zones are left, center, and right of the zero heading", () => {
    assert.equal(fns.drumZone(-40), 1)
    assert.equal(fns.drumZone(-25), 2)
    assert.equal(fns.drumZone(0), 2)
    assert.equal(fns.drumZone(25), 2)
    assert.equal(fns.drumZone(40), 3)
    assert.equal(fns.drumZone(-181), 0)
})

test("heading is unavailable when +X is vertical or the field is missing", () => {
    assert.equal(fns.headingDegrees(1, 0, 0, 0, 40, 10), -1)
    assert.equal(fns.headingDegrees(0, 0, -1, 0, 0, 0), -1)
})

test("axis dropdown blocks are present", () => {
    assert.match(src, /block="讀取 %quantity 的 %axis"/)
    assert.match(src, /block="面向角度"/)
    assert.match(src, /block="相對角度"/)
    assert.match(src, /block="將目前方向設為 0 度"/)
    for (const label of ["X 軸", "Y 軸", "Z 軸", "加速度 (g)", "角速度 (°/s)", "磁場 (µT)"]) {
        assert.ok(src.includes(`block="${label}"`), label)
    }
})

test("locale files cover every block id", () => {
    const ids = []
    const enumMember = /^\s+([A-Za-z0-9_]+)\s*=/gm
    for (const match of src.matchAll(/export function ([A-Za-z0-9_]+)/g)) {
        ids.push(`SEN0694.${match[1]}|block`)
    }
    const bodies = []
    for (const match of src.matchAll(/export enum ([A-Za-z0-9_]+) \{([\s\S]*?)\n    \}/g)) {
        const body = match[2]
        enumMember.lastIndex = 0
        for (const member of body.matchAll(enumMember)) {
            ids.push(`SEN0694.${match[1]}.${member[1]}|block`)
        }
    }
    ids.push("SEN0694|block")
    for (const locale of ["zh-TW", "zh-CN"]) {
        const json = JSON.parse(fs.readFileSync(new URL(`_locales/${locale}/sen0694-strings.json`, root), "utf8"))
        for (const id of ids) {
            assert.equal(typeof json[id], "string", `${locale} missing ${id}`)
            assert.ok(json[id].length > 0, id)
        }
    }
    JSON.parse(fs.readFileSync(new URL("pxt.json", root), "utf8"))
})
