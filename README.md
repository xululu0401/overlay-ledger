# 遮挡对账台（overlay-ledger）

单文件前端应用：`index.html` 由 `template.html` + `core.js` + `ui.js` 经 `build.cjs` 拼装。

```bash
node build.cjs
node --test tests/core.test.cjs
```

`core.js` 暴露 `window.AppCore`（Node 下为 `module.exports`）：`solve / unionArea / overlap / minShift`。
输入整数像素与整秒，矩形为半开区间；逐时间段求矩形并集被挡面积、积分、精确最小整数平移。
所有计算在本机完成，不联网、不读取视频或图片、不上传输入。需求口径见上级目录 `需求与调研.md`。
