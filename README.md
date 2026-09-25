# 长安一日

一本可以在浏览器里翻的汉服写真集。全部照片摄于二〇二六年八月二十九日，西安。

## 打开方式

直接在浏览器里打开 `index.html` 即可，不需要服务器。

翻页有三种方式：

- 点右下角或左下角的圆形按钮
- 键盘 `←` `→` 或空格
- 拖动书页的角

## 这本书

四十六页，四个章节。

| 章节 | 时间 | 地点 |
|---|---|---|
| 妆 | 14:41 至 15:30 | 德福巷 |
| 食 | 16:31 至 16:33 | 德福巷 |
| 园 | 18:00 至 19:19 | 唐苑 |
| 夜 | 20:18 至 22:07 | 钟楼 |

用了三十二张照片，每张下面印着它真实的拍摄时刻，取自相机写入的 EXIF，没有改写。

书里有四个跨页：同一张照片在左右两页各取一半，翻开来越过书脊重新拼合成一整幅。

## 配色

书里的颜色不是挑出来的，是从照片里取的。两位主角当天的衣服采样出两个主色：

- 靛蓝 `#3b4477`
- 藕紫 `#8f7c9c`

纸色用了中性冷白 `#f2f2ef`，没有用相册常见的米黄，因为米黄会压暗照片里傍晚和夜里的暖光。

## 目录

```
index.html              整本书的页面结构
styles.css              外壳：表头、舞台、翻页控件
style/book-style.css    页面本体：纸张、图版、图注、布面
flipbook.js             翻页逻辑与键盘、按钮绑定
html-contract.test.mjs  结构契约测试
vendor/                 PageFlip 翻页内核（MIT）
assets/photos/          三十二张照片，长边 2400px
```

## 检查

```bash
node --test html-contract.test.mjs
```

## 版权

照片版权归拍摄者与出镜者所有，未经许可请勿转载或另作他用。

翻页内核 [PageFlip](https://github.com/Nodlik/StPageFlip) 以 MIT 许可使用，许可证见 `vendor/PAGE-FLIP-LICENSE`。正文字体 Source Serif 4 以 SIL Open Font License 使用，许可证见 `style/fonts/LICENSE.md`。
