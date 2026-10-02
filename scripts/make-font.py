r"""相册楷体子集裁剪工具

页面正文与题字优先命中系统楷体（KaiTi / Kaiti SC / STKaiti，零下载），
没有楷体的环境（如 Android）由 @font-face 兜底加载本工具裁出的字符子集。
相册全部文字固定，子集按实际用字裁剪，体积只有全量字体的几十分之一。

字体源：fonts/FangZhengKaiSimplified.ttf（方正楷体简体），可用命令行参数指定其他路径。

用法（需要 fonttools + brotli，用 uv 临时环境最省事）：
    uv run --with fonttools --with brotli python scripts/make-font.py
    python scripts/make-font.py --check   # 只跑注释剥离自检，无需 fonttools

流程：扫描 src/ 里会渲染的字符（页面文字、图注 alt、CSS content、脚本文案，
先剥注释——注释里的汉字不渲染，进子集只是白占体积）+ 常用标点 + 全体 ASCII
→ 裁出 woff2 子集 → 写入 src/styles/fonts/album-kai.woff2（随仓库提交）。

改动页面文字后重跑一次即可扩大子集；忘记重跑时，新字符在 Android 上
回退系统字体，其余平台不受影响。
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "src" / "styles" / "fonts" / "album-kai.woff2"

# 公开分发需自行确认字体授权
FONT_SOURCE = ROOT / "fonts" / "FangZhengKaiSimplified.ttf"

# 安全缓冲：页面文本之外，标点/全角符号也一并带上（空间成本可忽略）
EXTRA_CHARS = (
    "「」『』（）［］｛｝《》〈〉〖〗"
    "…—～·、。，；：？！“”‘’（')"
    "￥＄％＋－＝｜＼／　〇"
)


# 行注释要求 // 前面是行首或空白，否则 url("https://…") 会被当成注释吃掉
COMMENT_PATTERNS = (
    re.compile(r"/\*.*?\*/", re.S),
    re.compile(r"<!--.*?-->", re.S),
    re.compile(r"(?m)(?:^|(?<=\s))//.*$"),
)


def strip_comments(text):
    for pattern in COMMENT_PATTERNS:
        text = pattern.sub("", text)
    return text


def collect_chars():
    """从 src/ 收集会渲染的字符：源码文本（去注释）+ ASCII 可打印区 + 标点缓冲。"""
    sources = [ROOT / "src" / "index.html", ROOT / "src" / "flipbook.js",
               ROOT / "src" / "styles" / "site.css", ROOT / "src" / "styles" / "book.css"]
    text = strip_comments("".join(p.read_text(encoding="utf-8") for p in sources))
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
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else FONT_SOURCE
    if not source.is_file():
        raise SystemExit("找不到字体源：%s" % source)

    text = collect_chars()
    make_subset(source, text, OUT_PATH)
    from fontTools.ttLib import TTFont
    covered = set(TTFont(OUT_PATH).getBestCmap())
    missing = sorted(c for c in text if ord(c) not in covered)
    kb = OUT_PATH.stat().st_size / 1024
    print("OK: %d 字 -> %s (%.0f KB)" % (len(text), OUT_PATH, kb))
    if missing:
        print("警告：字体源缺 %d 字，这些字在没有系统楷体的环境会回退其他字体：%s"
              % (len(missing), "".join(missing)))


def self_check():
    """注释剥离是这个脚本唯一的解析逻辑，也是唯一会静默出错的地方。"""
    out = strip_comments('正文乙 /* 甲 */ // 丙\nurl("https://丁/戊") <!-- 己 -->庚')
    assert "甲" not in out and "丙" not in out and "己" not in out, out
    assert "乙" in out and "庚" in out, out
    assert "https://丁/戊" in out, "URL 里的 // 不能当成行注释"


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--check":
        self_check()
        print("OK: strip_comments")
    else:
        main()
