r"""相册楷体子集裁剪工具

页面正文与题字优先命中系统楷体（KaiTi / Kaiti SC / STKaiti，零下载），
没有楷体的环境（如 Android）由 @font-face 兜底加载本工具裁出的字符子集。
相册全部文字固定，子集按实际用字裁剪，体积只有全量字体的几十分之一。

字体源（自动挑选，也可命令行指定路径覆盖）：
  1. fonts/FangZhengKaiSimplified.ttf  方正楷体简体（项目自带的源文件）

用法（需要 fonttools + brotli，用 uv 临时环境最省事）：
    uv run --with fonttools --with brotli python scripts/make-font.py

流程：扫描 src/ 里实际出现的每个字符（页面文字、图注 alt、CSS content、
脚本文案同源扫描，不会缺字）+ 常用标点 + 全体 ASCII → 裁出 woff2 子集 →
写入 src/styles/fonts/album-kai.woff2（随仓库提交）。

改动页面文字后重跑一次即可扩大子集；忘记重跑时，新字符在 Android 上
回退系统字体，其余平台不受影响。
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "src" / "styles" / "fonts" / "album-kai.woff2"

# 按优先级排列的字体源；公开分发需自行确认字体授权
FONT_CANDIDATES = [
    ("方正楷体简体（项目自带源文件）", ROOT / "fonts" / "FangZhengKaiSimplified.ttf"),
]

# 安全缓冲：页面文本之外，标点/全角符号也一并带上（空间成本可忽略）
EXTRA_CHARS = (
    "「」『』（）［］｛｝《》〈〉〖〗"
    "…—～·、。，；：？！“”‘’（')"
    "￥＄％＋－＝｜＼／　〇"
)


def collect_chars():
    """从 src/ 源文件收集字符集：全部字符 + ASCII 可打印区 + 标点缓冲。"""
    sources = [ROOT / "src" / "index.html", ROOT / "src" / "flipbook.js",
               ROOT / "src" / "styles" / "site.css", ROOT / "src" / "styles" / "book.css"]
    text = "".join(p.read_text(encoding="utf-8") for p in sources)
    chars = set(text) | set(EXTRA_CHARS) | {chr(c) for c in range(0x20, 0x7F)}
    chars.discard("\n")
    return "".join(sorted(chars))


def make_subset(source_ttf, text, out_path):
    from fontTools.subset import Subsetter, Options, load_font, save_font

    opts = Options()
    opts.flavor = "woff2"
    font = load_font(source_ttf, opts)
    subsetter = Subsetter(options=opts)
    subsetter.populate(text=text)
    subsetter.subset(font)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    save_font(font, out_path, opts)


def main():
    if len(sys.argv) > 1:  # 命令行显式指定字体源
        source, label = Path(sys.argv[1]), "命令行指定"
        if not source.is_file():
            raise SystemExit("指定的字体不存在：%s" % source)
    else:
        source, label = None, ""
        for cand_label, cand in FONT_CANDIDATES:
            if cand.is_file():
                source, label = cand, cand_label
                break
        if source is None:
            raise SystemExit("找不到字体源（fonts/FangZhengKaiSimplified.ttf）")

    text = collect_chars()
    make_subset(source, text, OUT_PATH)
    kb = OUT_PATH.stat().st_size / 1024
    print("OK: 字体源[%s] %d 字 -> %s (%.0f KB)" % (label, len(text), OUT_PATH, kb))


if __name__ == "__main__":
    main()
