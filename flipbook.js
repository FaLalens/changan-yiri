const bookElement = document.querySelector("#book");
const pages = bookElement.querySelectorAll(".book-page");
const previousButton = document.querySelector("#previous");
const nextButton = document.querySelector("#next");
const pageStatus = document.querySelector("#page-status");
const orientationStatus = document.querySelector("#orientation");
const pageWidth = Number(bookElement.dataset.pageWidth) || 512;
const pageHeight = Number(bookElement.dataset.pageHeight) || 640;
document.documentElement.style.setProperty("--page-ratio", pageWidth / pageHeight);

// 叶片上限是唯一真源：这里定义一次，写进 CSS 变量供版式使用，
// 同时交给 PageFlip 当作 maxWidth。两处同源就不会互相夹住。
const leafMax = 1200;
document.documentElement.style.setProperty("--page-ratio", pageWidth / pageHeight);
document.documentElement.style.setProperty("--leaf-max", `${leafMax}px`);

const pageFlip = new St.PageFlip(bookElement, {
  width: pageWidth,
  height: pageHeight,
  size: "stretch",
  minWidth: Math.max(1, Math.round(pageWidth * 0.56)),
  maxWidth: leafMax,
  minHeight: Math.max(1, Math.round(pageHeight * 0.56)),
  maxHeight: Math.round((leafMax * pageHeight) / pageWidth),
  drawShadow: true,
  flippingTime: 760,
  usePortrait: true,
  startZIndex: 10,
  autoSize: true,
  maxShadowOpacity: 0.42,
  showCover: true,
  mobileScrollSupport: false,
  clickEventForward: true,
  useMouseEvents: true,
  swipeDistance: 24,
  showPageCorners: true,
  disableFlipByClick: false,
});

let currentPage = 0;
let isTurning = false;

/* ---- 照片按需加载 -------------------------------------------------
   页面里先放 5KB 的模糊占位图，整本首屏不到 10KB 就能翻。
   真图只加载"当前页 + 前后各 2 页"，翻到哪补到哪。
   窄屏取 1200px 版本，宽屏取 1800px 版本。
   跨页的左右两半是同一张照片的两个 img，浏览器只会下载一次；
   但两处都得各自换 src，所以这里按元素记，不按照片编号记。 */
const smallScreen =
  typeof window.matchMedia === "function"
    ? window.matchMedia("(max-width: 700px)")
    : { matches: false, addEventListener() {} };
const done = new WeakMap();                      // img 元素 -> 已应用的 URL

function photoUrl(stem) {
  return `assets/photos/${stem}${smallScreen.matches ? "@m" : ""}.webp`;
}

function upgrade(scope) {
  if (typeof scope?.querySelectorAll !== "function") return;
  scope.querySelectorAll("img[data-photo]").forEach((img) => {
    const stem = img.dataset?.photo;
    if (!stem) return;
    const url = photoUrl(stem);
    if (done.get(img) === url) return;            // 这一处已是当前规格
    done.set(img, url);
    const next = new Image();
    next.decoding = "async";
    next.onload = () => { img.src = url; };       // 解码完再换，避免闪白
    next.src = url;
  });
}

// 跨页横跨两个连续页索引，所以窗口要连成一片，
// 不能只取 page-2 / page / page+2，那会正好跳过跨页的右半。
function upgradeAround(page) {
  const from = Math.max(0, page - 2);
  const to = Math.min(pages.length - 1, page + 3);
  for (let i = from; i <= to; i += 1) upgrade(pages[i]);
}

function updateControls() {
  const pageCount = pageFlip.getPageCount();
  const lastPage = pageCount - 1;
  bookElement.dataset.edge = currentPage === 0 ? "front" : currentPage === lastPage ? "back" : "inside";

  previousButton.disabled = currentPage === 0 || isTurning;
  nextButton.disabled = currentPage === lastPage || isTurning;

  if (currentPage === 0) {
    pageStatus.textContent = "封面";
  } else if (currentPage === lastPage) {
    pageStatus.textContent = "封底";
  } else {
    pageStatus.textContent = `${String(currentPage + 1).padStart(2, "0")} / ${String(pageCount).padStart(2, "0")}`;
  }
}

pageFlip.on("flip", (event) => {
  currentPage = Number(event.data);
  updateControls();
  upgradeAround(currentPage);
});

pageFlip.on("changeState", (event) => {
  isTurning = event.data !== "read";
  updateControls();
});

// 横竖屏切换会改变图片规格，换完要把已看过的页重新升一遍
smallScreen.addEventListener("change", () => {
  upgradeAround(currentPage);
});

function updateOrientation(orientation) {
  bookElement.dataset.layout = orientation;
  orientationStatus.textContent = orientation === "portrait" ? "单页" : "对开";
}

pageFlip.on("init", (event) => updateOrientation(event.data.mode));
pageFlip.on("changeOrientation", (event) => updateOrientation(event.data));

pageFlip.loadFromHTML(pages);
updateControls();

const requestedPage = Number(new URLSearchParams(location.search).get("page"));
if (Number.isInteger(requestedPage) && requestedPage >= 0 && requestedPage < pages.length) {
  pageFlip.turnToPage(requestedPage);
  currentPage = requestedPage;
  updateControls();
}

// 首屏：封面和开头两页立刻升级，其余等翻到再说
upgradeAround(currentPage);

previousButton.addEventListener("click", () => {
  if (!isTurning) pageFlip.flipPrev("bottom");
});

nextButton.addEventListener("click", () => {
  if (!isTurning) pageFlip.flipNext("bottom");
});

window.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || isTurning ||
      event.target?.closest?.("button, input, textarea, select, [contenteditable]")) return;

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    pageFlip.flipPrev("bottom");
  }

  if (event.key === "ArrowRight" || event.key === " ") {
    event.preventDefault();
    pageFlip.flipNext("bottom");
  }

  if (event.key === "Home") pageFlip.turnToPage(0);
  if (event.key === "End") pageFlip.turnToPage(pageFlip.getPageCount() - 1);
});
