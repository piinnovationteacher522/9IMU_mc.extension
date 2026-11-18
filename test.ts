// Compile-time smoke test for the SEN0694 blocks. MakeCode compiles this
// against the extension; it does not need a sensor attached.
function sen0694Smoke(): void {
    SEN0694.begin(SEN0694.Address.Addr4A)
    SEN0694.setMode(SEN0694.Mode.Normal)
    SEN0694.setAccelRange(SEN0694.AccelRange.G2)
    SEN0694.setGyroRange(SEN0694.GyroRange.Dps250)

    const ax = SEN0694.read(SEN0694.Quantity.Acceleration, SEN0694.Axis.X)
    const gy = SEN0694.read(SEN0694.Quantity.AngularVelocity, SEN0694.Axis.Y)
    const mz = SEN0694.read(SEN0694.Quantity.MagneticField, SEN0694.Axis.Z)

    SEN0694.setInterrupt(SEN0694.IntPin.INT1, SEN0694.IntEvent.Step)
    SEN0694.setMagInterrupt(SEN0694.MagInt.DataReady)
    const steps = SEN0694.stepCount()
    const tap = SEN0694.tap()
    const dir = SEN0694.direction()
    const facing = SEN0694.face()
    SEN0694.setHeadingZero()
    SEN0694.setStickLevel()
    SEN0694.setStrikeThreshold(220)
    const bearing = SEN0694.heading()
    const turned = SEN0694.relativeHeading()
    const elev = SEN0694.stickElevation()
    const height = SEN0694.tipHeight(32)
    const rate = SEN0694.tipRate()
    const zone = SEN0694.drum()
    const hit = SEN0694.wasStruck()
    const speed = SEN0694.strikeSpeed()
    SEN0694.onStrike(function () {
        basic.pause(1)
    })
    const ok = SEN0694.isConnected()

    if (ok && ax + gy + mz + steps + tap + dir + facing + bearing + turned + elev + height + rate + zone + speed > -100000 && !hit) {
        basic.pause(1)
    }
    SEN0694.reset()
}

sen0694Smoke()
