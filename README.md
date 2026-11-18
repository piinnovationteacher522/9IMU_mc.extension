# SEN0694 9 軸慣性運動感測器 — micro:bit 積木擴充

DFRobot Gravity 9 軸慣性運動感測器（SKU: SEN0694）的 [MakeCode for micro:bit](https://makecode.microbit.org/) 擴充。加速度、角速度、磁場各有下拉選單，直接選 X、Y 或 Z 軸。

產品說明：<https://wiki.dfrobot.com.cn/SKU_SEN0694_Gravity_9轴惯性运动传感器>

## 積木

工具箱分類名稱是 **SEN0694 9軸**。

### 讀取

| 積木 | 下拉選單 | 單位 |
| --- | --- | --- |
| `讀取 [加速度 (g) ▼] 的 [X 軸 ▼]` | 加速度 (g)、角速度 (°/s)、磁場 (µT)；X 軸、Y 軸、Z 軸 | g、°/s、µT |
| `面向角度` | 無 | 度，0 到 360，磁北為 0 |
| `相對角度` | 無 | 度，向右 0 到 180，向左 0 到 -180 |

同一個積木拖兩次，就能各讀各的軸。例如一次選加速度的 X 軸，另一次選磁場的 Z 軸。

`面向角度` 是模組 **+X 軸**相對磁北的角度：0 指向磁北，90 指向磁東，180 指向磁南，270 指向磁西，從正上方看是順時針。平放或傾斜時都會用加速度把磁場拉平。+X 幾乎朝天或朝地時回傳 -1。這是磁北；香港的磁北和地圖真北差幾度。喇叭、馬達或鐵桌會把角度拉歪。它和「放置方向」「正反面」不同，後者只說明哪一邊朝上，沒有連續的度數。

敲擊時加速度會衝高，不再指向地心。`面向角度` 和 `相對角度` 會丟掉這一筆加速度，沿用敲擊前的傾斜，並用陀螺儀補上敲擊中的轉動，所以角度不會跳。不必另外打開「敲擊」中斷。平常手持的晃動仍會更新。敲得比陀螺儀量程還快時，那一下的轉動會晚一點才跟上；常敲的話把陀螺儀量程設成 **±2000 °/s**。用磁鐵或鐵器去敲，磁場本身被吸偏，角度仍會不準。

`將目前方向設為 0 度` 會把當下的面向角度記成 0。之後 `相對角度` 以這個方向為準：向右轉是正數，最大 180；向左轉是負數，最大 -180。正後方會顯示 180 或 -180。還沒按過歸零時，相對角度的 0 仍是磁北。讀不到方向時，歸零不會改掉舊的 0 度，相對角度回傳 -1。

### 空氣鼓

模組貼在鼓棍上，電路板印的 **+X 指向棍頭**，鼓棍拿平時模組正面朝上。抬高棍頭時，`鼓棍仰角` 要變大；若變小，把模組掉轉頭。

| 積木 | 說明 |
| --- | --- |
| `當鼓棍打擊時` | 棍頭向下快揮、然後慢下來時執行一次，約是落到鼓面的時刻 |
| `發生打擊` | 同一次打擊的布林值，讀走後變回假 |
| `這次打擊速度 (°/s)` | 這一揮向下的最快角速度，用來調音量 |
| `棍頭角速度` | 當下的上下揮速。向上為正，向下為負 |
| `鼓棍仰角` | 棍頭抬離水平的角度。朝上為正，朝下為負，水平為 0 |
| `棍頭高度 (cm) 棍長 [32]` | 棍頭比手腕高幾公分。水平是 0 |
| `鼓位` | 左、中、右。先把棍頭指向中間的鼓，再「將目前方向設為 0 度」 |
| `將目前姿勢設為水平` | 鼓棍沒貼平時，把現在的姿勢記成仰角 0 |
| `設定打擊門檻為 [220] °/s` | 向下揮得比這更快才算一擊 |

`棍頭高度` 是手腕當支點、棍長固定算出來的。九軸 IMU 沒有氣壓計，不能知道離地板幾公分；整隻手臂上下移動也不會算進高度。打鼓時把手腕高度維持住，棍頭高度就能當成離鼓面的高度。

用到空氣鼓積木、而且還沒自己設過量程時，加速度會改成 **±8 g**、陀螺儀改成 **±2000 °/s**，快揮才不會超出量程。

### 設定

| 積木 | 下拉選單 |
| --- | --- |
| `將目前方向設為 0 度` | 把此刻的面向角度記成相對角度的 0 |
| `初始化 SEN0694 地址 [0x4A ▼]` | 0x4A、0x4B、0x4C、0x4D |
| `設定工作模式為 [正常 ▼]` | 睡眠、低功耗、正常、高性能 |
| `設定加速度量程為 [±2 g ▼]` | ±2 g、±4 g、±8 g、±16 g |
| `設定陀螺儀量程為 [±250 °/s ▼]` | ±125、±250、±500、±1000、±2000 °/s |
| `SEN0694 已連線` | 布林值，確認 I2C 有回應 |

沒有放初始化積木時，第一次讀取會用地址 **0x4A**、**正常**模式、加速度 **±2 g**、陀螺儀 **±250 °/s** 自動啟動。這組和 DFRobot 的 I2C 範例相同，小動作比較看得清楚。量程改了之後，換算會跟著變，不用自己除靈敏度。

`恢復 SEN0694 出廠設定` 在分類的進階區。出廠量程是加速度 ±8 g、陀螺儀 ±2000 °/s。

### 運動偵測

計步、敲擊、放置方向要先用下拉選單打開對應功能，數值才會更新。INT 腳不必接到 micro:bit，積木是用 I2C 輪詢。

| 積木 | 說明 |
| --- | --- |
| `設定 [INT1 ▼] 為 [計步 ▼]` | INT1 或 INT2：關閉、資料就緒、任意運動、靜止、顯著運動、計步、平放、方向、敲擊、傾斜 |
| `設定 INT3 為 [資料就緒 ▼]` | 磁力計中斷，只有關閉或資料就緒 |
| `步數` | 累計步數 |
| `敲擊` | 無、單擊、雙擊、三擊 |
| `放置方向` | 未知、豎屏正向、橫屏向左、橫屏向右、豎屏倒置 |
| `正反面` | 面向前、面向後、未知 |

## 接線

撥碼開關切到 **I2C**。地址撥碼 A0=0、A1=0 是出廠的 **0x4A**。改撥碼後要重新上電才生效。

| SEN0694 | micro:bit |
| --- | --- |
| + | 3V |
| − | GND |
| C/R（SCL） | P19，板邊 SCL |
| D/T（SDA） | P20，板邊 SDA |

供電用 micro:bit 的 3V。不要接 5V。此擴充只走 I2C，不要把通訊撥碼撥到 UART。

## 加進 MakeCode

1. 把這個專案放到 GitHub。根目錄要有 `pxt.json`。
2. 打開 <https://makecode.microbit.org/> ，新增專案。
3. 工具箱最下方點 **擴充功能**，貼上儲存庫網址，搜尋後加入。
4. 工具箱出現 **SEN0694 9軸**。

積木文字是繁體中文。MakeCode 介面改成簡體中文時，會改顯示 `_locales/zh-CN` 的文字。

模擬器沒有這顆感測器，讀數會是 0。`SEN0694 已連線` 在模擬器裡是假。要用實機。

## 範例

開機時初始化，然後用序列埠看小數。MakeCode 的 LED `顯示數字` 只顯示整數；序列埠的「寫入數值」看得到小數。

```javascript
SEN0694.begin(SEN0694.Address.Addr4A)
SEN0694.setMode(SEN0694.Mode.Normal)
SEN0694.setAccelRange(SEN0694.AccelRange.G2)
SEN0694.setGyroRange(SEN0694.GyroRange.Dps250)

basic.forever(function () {
    serial.writeValue("ax", SEN0694.read(SEN0694.Quantity.Acceleration, SEN0694.Axis.X))
    serial.writeValue("ay", SEN0694.read(SEN0694.Quantity.Acceleration, SEN0694.Axis.Y))
    serial.writeValue("az", SEN0694.read(SEN0694.Quantity.Acceleration, SEN0694.Axis.Z))
    serial.writeValue("gx", SEN0694.read(SEN0694.Quantity.AngularVelocity, SEN0694.Axis.X))
    serial.writeValue("mx", SEN0694.read(SEN0694.Quantity.MagneticField, SEN0694.Axis.X))
    basic.pause(200)
})
```

水平靜止、模組正面朝上時，加速度 X、Y 接近 0 g，Z 約為 -1 g 或 +1 g（看模組座標方向）。角速度在靜止時接近 0。磁場隨擺放方向變化，大約是數十 µT。

若要在 LED 點陣上看加速度，可把數值乘 100 再四捨五入，單位就變成 0.01 g：

```javascript
basic.showNumber(Math.round(SEN0694.read(SEN0694.Quantity.Acceleration, SEN0694.Axis.Z) * 100))
```

面向角度可以直接顯示整數。把模組 +X 軸指向北方時應接近 0：

```javascript
basic.forever(function () {
    basic.showNumber(Math.round(SEN0694.heading()))
    basic.pause(300)
})
```

## 空氣鼓棍

1. 模組靠近手握處固定，+X 指向棍頭，正面朝上。
2. 棍頭指向中間那面鼓，鼓棍拿平，按 A 鍵歸零。
3. `當鼓棍打擊時` 裡用 `鼓位` 選音高，用 `這次打擊速度` 調音量。棍頭還高過 12 公分就當成揮空，不發聲。

```javascript
input.onButtonPressed(Button.A, function () {
    SEN0694.setHeadingZero()
    SEN0694.setStickLevel()
    basic.showIcon(IconNames.Yes)
})
SEN0694.onStrike(function () {
    if (SEN0694.tipHeight(32) > 12) {
        return
    }
    const speed = SEN0694.strikeSpeed()
    music.setVolume(Math.constrain(Math.map(speed, 220, 900, 50, 255), 0, 255))
    const where = SEN0694.drum()
    let freq = 262
    if (where == SEN0694.Drum.Left) freq = 196
    if (where == SEN0694.Drum.Center) freq = 330
    if (where == SEN0694.Drum.Right) freq = 523
    music.play(music.tonePlayable(freq, music.beat(BeatFraction.Eighth)), music.PlaybackMode.InBackground)
})
```

音調用「在背景播放」，才不會把下一擊延後。輕揮沒有聲音時，把打擊門檻調低；走路也會響時，把門檻調高。

## 數值怎麼換算

I2C 讀到的是小端序有號整數，和 DFRobot Arduino 函式庫相同。

- 加速度（g）= 原始值 × 量程 / 32768
- 角速度（°/s）= 原始值 × 量程 / 32768
- 磁場（µT）= 32 位元原始值 × 0.01

±8 g 時每 g 是 4096 LSB，和規格書一致。例如原始值 -4127、量程 ±8 g，結果約 -1.008 g。Wiki 範例把暫存器字 `FF DD` 寫成十進位 -43；這個十六進位的二補數是 -35，擴充依十六進位換算。

Wiki 的 Modbus 暫存器表是 **UART** 用的。I2C 位址不同：加速度 X 在 `0x0010`，不是 Modbus 的 `0x0006`。這份擴充用的是函式庫裡的 `REG_I2C_*`。

同一次迴圈裡，30 毫秒內的加速度和角速度共用一次取樣；磁場另外取樣。所以連續讀 X、Y、Z 會是同一筆資料。

## 本機檢查

換算與暫存器位址的測試不需要 micro:bit：

```bash
npm install
npm test
npm run typecheck
```

`npm test` 用規格書的靈敏度表，以及 Wiki 範例裡的暫存器十六進位，核對換算公式。`typecheck` 只檢查 TypeScript，不會連上感測器。
