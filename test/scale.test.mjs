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
        `${slice}\nreturn { lsbToG, lsbToDps, magToUt, decodeU16, decodeI16, decodeI32, decodeU32, encodeWrite, rangeToG, rangeToDps };`
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

test("axis dropdown blocks are present", () => {
    assert.match(src, /block="讀取 %quantity 的 %axis"/)
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
