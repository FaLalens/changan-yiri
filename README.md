# 长安一日

[打开相册](https://falalens.github.io/changan-yiri/)

一本可以在浏览器里翻的汉服写真集，照片摄于 2026 年 8 月 29 日，西安。全书 36 页，使用 23 张照片，包含 4 个跨页。

| 章节 | 拍摄时间 | 地点 |
| --- | --- | --- |
| 巷 | 14:41–16:33 | 德福巷 |
| 园 | 17:59–19:12 | 唐苑 |
| 夜 | 20:49–22:10 | 钟楼 |

## 阅读

相册使用原生 HTML、CSS、JavaScript 和本地 PageFlip 内核。推荐从仓库根目录启动一个静态服务，再打开 `http://localhost:8000/src/`：

```bash
python -m http.server 8000
```

直接双击 [src/index.html](src/index.html) 也能查看页面：照片照常显示，楷体优先命中系统字体，个别浏览器在 `file://` 下可能不加载项目内的子集字体。

- 翻页：底部左右按钮、键盘 `←` / `→` / 空格，或拖动书页角。
- 跳页：顶部地点导航、底部页码滑条；`Home` 回封面，`End` 到封底。
- 布局：窄窗口通常为单页，宽窗口为对开，实际布局由书页可用空间决定。

链接加上 `?page=14` 可直接打开唐苑章节。页索引从 `0` 开始，封底为 `35`。

## 修改与发布

日常编辑 `src/`。`public/` 是生成目录，构建时会被覆盖，已加入 Git 忽略规则。

1. 根据要修改的内容找到对应文件：

   | 文件 | 用途 |
   | --- | --- |
   | [src/index.html](src/index.html) | 页面顺序、照片引用、图注与章节 |
   | [src/flipbook.js](src/flipbook.js) | 翻页、导航、图片按需加载 |
   | [src/styles/site.css](src/styles/site.css) | 表头、舞台、控件与响应式布局 |
   | [src/styles/book.css](src/styles/book.css) | 纸页、布面、照片与装帧 |

2. 在仓库根目录运行构建与检查（与 CI 一致），需要 Node.js 和 Python 3：

   ```bash
   python scripts/build-site.py
   node --test tests/html-contract.test.mjs
   ```

   构建会把 `src/` 完整复制到 `public/` 并生成 `.nojekyll`。可直接打开 `public/index.html` 检查发布版本。

   改动页面文字后还需重跑一次字体子集裁剪（需要 [uv](https://docs.astral.sh/uv/)）：

   ```bash
   uv run --with fonttools --with brotli python scripts/make-font.py
   ```

3. 提交源码并推送到 `main`。GitHub Actions 自动构建、运行测试并部署 `public/`，完成后刷新相册链接。

   [查看部署状态](https://github.com/FaLalens/changan-yiri/actions) · [发布工作流](.github/workflows/deploy.yml)

[tests/html-contract.test.mjs](tests/html-contract.test.mjs) 检查页面与资源结构、封面图片规格、导航键盘行为、章节状态和硬页终点绘制。涉及布局或翻页动画的修改还需在浏览器中检查单页、对开和开合过程。

### 重建照片

照片存放在 `src/assets/photos/` 下的 `defuxiang/`、`tangyuan/`、`zhonglou/` 三个目录。HTML 用 `data-photo="章节目录/照片名"` 引用，不包含扩展名。

需要从修图原文件重新生成 WebP 时：

1. 准备原始照片目录，保持 [scripts/build-photos.py](scripts/build-photos.py) 中 `SELECTION` 定义的子目录与文件名。
2. 安装支持 WebP 的 Pillow：`python -m pip install Pillow`。
3. 在仓库根目录运行：

   ```bash
   python scripts/build-photos.py "照片源目录"
   ```

脚本生成桌面版（长边 2400、质量 88）和 `@m` 版（长边 1200、质量 86），自动校正 EXIF 方向，不修改源文件。重建后按上面的步骤检查、构建与发布。

## 图片加载

照片区域在请求期间显示细线墨圈，加载成功后显示照片并隐藏图标，失败时显示错误提示。页面不请求模糊占位图。

| 图片位置 | 窗口宽度 | 使用文件 | 长边上限 |
| --- | --- | --- | --- |
| 封面 | 任意宽度 | `照片名@m.webp` | 1200px |
| 内页 | ≤700px | `照片名@m.webp` | 1200px |
| 内页 | >700px | `照片名.webp` | 2400px |

只请求当前页、前 2 页和后 3 页范围内的照片，不会一次下载整本相册。前后页范围连续，保证跨页的左右半幅都能加载。

窗口跨过 700px 时，当前范围的内页切换图片规格，封面始终保留 `@m.webp`。再次使用同一文件时，通常复用浏览器缓存；跨页两半也使用同一个图片 URL。

## 设计与维护

配色来自当天服饰：靛蓝布面 `#354174`、藕紫点缀 `#8f7c9c`，搭配金线、蓝绿色发饰纹样和中性冷白纸面 `#f2f2ef`。

封面以正楷题字、花窗裁切的钟楼双人照和细金边构成；章节页使用浅色纸面与局部印花。正文与封面题字优先命中系统楷体（KaiTi / Kaiti SC / STKaiti），没有楷体的环境加载随站点提供的字符子集 `album-kai.woff2`，由 [scripts/make-font.py](scripts/make-font.py) 从方正楷体裁出，改动页面文字后需重跑；署名使用随站点提供的手写字体。

<details>
<summary>装帧与翻页维护要点</summary>

- 书脊使用浅凹槽，封面构图在凹槽右侧区域居中；封面和封底使用独立的深色包边。
- 纸张侧面与底面共用尺寸，左右镜像，厚度随阅读进度变化；调整时需同时检查静止页和翻动页。
- 跨页照片在图版内裁切。唐苑 19:02 的左右半幅使用一致的右对齐裁切，让书缝避开面部。
- 本地 PageFlip 内核包含硬页垂直偏移、小数尺寸裁切和柔页边缘覆盖修正；`flipbook.js` 还统一了硬页开合终点的绘制姿态。升级内核时需保留或重新验证这些行为。

</details>

## 版权与字体

照片版权归拍摄者与出镜者所有，未经许可请勿转载或另作他用。

| 资源 | 许可与说明 |
| --- | --- |
| PageFlip 翻页内核 | [MIT](src/vendor/PAGE-FLIP-LICENSE) |
| 方正楷体简体正文与题字 | [album-kai.woff2](src/styles/fonts/album-kai.woff2)（字符子集）· 源文件 [FangZhengKaiSimplified.ttf](fonts/FangZhengKaiSimplified.ttf) |
| Qwitcher Grypen 署名与日期 | [SIL OFL 1.1](src/styles/fonts/QwitcherGrypen-OFL.txt) |

字体文件由项目维护者提供，使用前请遵守字体授权条款。
