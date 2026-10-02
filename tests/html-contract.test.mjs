import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const root = new URL("../src/", import.meta.url);
const index = await readFile(new URL("index.html", root), "utf8");
const script = await readFile(new URL("flipbook.js", root), "utf8");
const styles = await readFile(new URL("styles/site.css", root), "utf8");
const bookStyles = await readFile(new URL("styles/book.css", root), "utf8");
const pages = [...index.matchAll(/<article\b[^>]*class="[^"]*\bbook-page\b[^"]*"[^>]*>/g)].map(
  ([tag]) => tag,
);

/* flipbook.js 直接用 DOM、不做存在性兜底，所以 mock 必须把它用到的成员备齐：
   少一个就会在那里抛错，测试也就测不到后面那半截。 */
const element = (extra) => ({
  dataset: {}, textContent: "", disabled: false, value: "", max: "",
  attributes: new Map(), listeners: {},
  style: { vars: {}, setProperty(name, value) { this.vars[name] = value; } },
  classList: { add() {}, remove() {} },
  setAttribute(name, value) { this.attributes.set(name, value); },
  removeAttribute(name) { this.attributes.delete(name); },
  addEventListener(name, handler) { this.listeners[name] = handler; },
  querySelectorAll: () => [],
  insertAdjacentHTML() {},
  closest: () => null,
  ...extra,
});

const bookOf = (leaves, dataset) => element({
  dataset: { pageWidth: "480", pageHeight: "640", ...dataset },
  querySelectorAll: () => leaves,
});

// 返回的 document 上挂着 controls，方便断言某个控件的具体状态
const documentOf = (bookEl, chapters = []) => {
  const controls = new Map();
  return {
    documentElement: { style: { setProperty() {} } },
    querySelector: (selector) => {
      if (selector === "#book") return bookEl;
      if (!controls.has(selector)) controls.set(selector, element());
      return controls.get(selector);
    },
    querySelectorAll: (selector) => (selector === "[data-chapter]" ? chapters : []),
    controls,
  };
};

const windowOf = (media, extra) => ({
  matchMedia: () => media ?? { matches: false, addEventListener() {} },
  addEventListener() {},
  ...extra,
});

test("template is vanilla HTML", () => {
  assert.doesNotMatch(`${index}\n${script}\n${styles}`, /react|jsx|vite/i);
  assert.match(index, /id="book"/);
  assert.match(index, /data-page-width="\d+"/);
  assert.match(index, /data-page-height="\d+"/);
  assert.match(index, /vendor\/page-flip\.browser\.js/);
  // .art-page 与 .book-page 特异度相同，overflow/background 由后来者胜出，故 book.css 必须在前
  assert.ok(index.indexOf('href="styles/book.css"') < index.indexOf('href="styles/site.css"'),
    "book.css must be linked before site.css");
  assert.doesNotMatch(index, /rel="preload"/);
  assert.match(script, /new St\.PageFlip/);
  assert.match(script, /loadFromHTML\(pages\)/);
  assert.match(script, /bookElement\.dataset\.pageWidth/);
  assert.match(script, /bookElement\.dataset\.pageHeight/);
  assert.doesNotMatch(index, /src="assets\/photos\/blur\//);
  assert.match(bookStyles, /photo-loading-spin/);
  assert.match(bookStyles, /local\("KaiTi"\)/);
  assert.match(bookStyles, /album-kai\.woff2/);
  assert.match(bookStyles, /font-display:swap/);
  assert.match(bookStyles, /方正楷体简体/);
  assert.doesNotMatch(bookStyles, /Source Serif|Cover Kai|FandolKai/);
  assert.match(styles, /\.book-page\.\--left::before/);
  assert.match(styles, /\.book-page\.\--right::before/);
  assert.match(styles, /z-index:\s*3/);
  assert.match(styles, /linear-gradient\(to (?:left|right)/);
  assert.doesNotMatch(styles, /box-shadow:\s*inset/);
  assert.doesNotMatch(styles, /book-gutter|data-orientation="landscape"/);
});

test("cover and page density contract is valid", () => {
  assert.ok(pages.length >= 2);
  assert.match(pages[0], /data-density="hard"/);
  assert.match(pages.at(-1), /data-density="hard"/);
  for (const page of pages.slice(1, -1)) assert.doesNotMatch(page, /data-density="hard"/);
});

test("default page size stays inside the UI envelope", () => {
  const width = Number(index.match(/data-page-width="(\d+)"/)?.[1]);
  const height = Number(index.match(/data-page-height="(\d+)"/)?.[1]);
  assert.ok(Math.max(width, height) <= 640);
});

test("vendored runtime and photo directory exist", async () => {
  assert.equal((await stat(new URL("vendor/page-flip.browser.js", root))).isFile(), true);
  assert.equal((await stat(new URL("assets/photos/", root))).isDirectory(), true);
  assert.equal((await stat(new URL("styles/fonts/album-kai.woff2", root))).isFile(), true);
  await assert.rejects(stat(new URL("styles/fonts/FangZhengKaiSimplified.ttf", root)),
    undefined, "Full TTF must not ship with the site");
});

test("every selected photo has desktop and mobile files", async () => {
  const photoIds = [...index.matchAll(/data-photo="([^"]+)"/g)].map(([, id]) => id);
  const unique = new Set(photoIds);
  assert.equal(unique.size, 23);
  assert.equal(pages.length, 36);
  for (const id of unique) {
    assert.match(id, /^(defuxiang|tangyuan|zhonglou)\/XiAn_20260829_\d{6}$/);
    for (const path of [
      `assets/photos/${id}.webp`,
      `assets/photos/${id}@m.webp`,
    ]) {
      assert.equal((await stat(new URL(path, root))).isFile(), true, path);
    }
  }
});

test("spread halves face each other across the gutter", () => {
  const halves = [...index.matchAll(/<article\b[^>]*class="[^"]*\bbook-page\b[^"]*"[^>]*aria-label="[^"]*(?:左半|右半)"[^>]*>/g)]
    .map((match) => ({ tag: match[0], index: pages.findIndex((page) => page === match[0]) }));
  assert.equal(halves.length, 8);
  for (let i = 0; i < halves.length; i += 2) {
    assert.match(halves[i].tag, /verso.*左半/);
    assert.match(halves[i + 1].tag, /recto.*右半/);
    assert.equal(halves[i].index % 2, 1);
    assert.equal(halves[i + 1].index, halves[i].index + 1);
  }
});

test("cover keeps the mobile photo while inner pages follow viewport changes", () => {
  const requests = [];
  const media = { matches: true, addEventListener(name, handler) { this.change = handler; } };
  const frame = element();
  const photo = (stem, isCover) => ({
    dataset: { photo: stem },
    closest: (selector) => selector === ".cover-plate" ? (isCover ? frame : null) : frame,
  });
  const cover = photo("zhonglou/XiAn_20260829_210250", true);
  const inner = photo("defuxiang/XiAn_20260829_144100", false);
  const leaves = [cover, inner].map(img => element({ querySelectorAll: () => [img] }));
  class PageFlip {
    on() {} loadFromHTML() {}
    getPageCount() { return 2; }
    getRender() { return null; }
  }
  class Image {
    set src(url) { requests.push(url); this.onload(); }
  }
  runInNewContext(script, {
    document: documentOf(bookOf(leaves)),
    St: { PageFlip }, Image, location: { search: "" }, URLSearchParams,
    window: windowOf(media),
  });
  assert.equal(cover.src, `assets/photos/${cover.dataset.photo}@m.webp`);
  assert.equal(inner.src, `assets/photos/${inner.dataset.photo}@m.webp`);
  requests.length = 0;
  media.matches = false;
  media.change();
  assert.equal(cover.src, `assets/photos/${cover.dataset.photo}@m.webp`);
  assert.equal(inner.src, `assets/photos/${inner.dataset.photo}.webp`);
  assert.deepEqual(requests, [inner.src], "Resizing never requests a desktop cover");
  media.matches = true;
  media.change();
  assert.equal(inner.src, `assets/photos/${inner.dataset.photo}@m.webp`);
  assert.ok(requests.every(url => !url.includes(cover.dataset.photo)));
});

test("focused controls keep their native keyboard actions", () => {
  const actions = [];
  const handlers = {};
  class PageFlip {
    on() {}
    getPageCount() { return 8; }
    loadFromHTML() {}
    getRender() { return null; }
    turnToPage(page) { actions.push(["turn", page]); }
    flipNext() { actions.push(["next"]); }
    flipPrev() { actions.push(["previous"]); }
  }
  runInNewContext(script, {
    document: documentOf(bookOf(Array.from({ length: 8 }, () => element()), { pageWidth: "512" })),
    St: { PageFlip }, location: { search: "" }, URLSearchParams,
    window: windowOf(null, { addEventListener: (name, handler) => { handlers[name] = handler; } }),
  });
  assert.deepEqual(actions, [], "No page query leaves the book on its cover");
  actions.length = 0;
  const keydown = handlers.keydown;
  keydown({ key: " ", target: { closest: () => ({}) }, preventDefault: () => { throw Error("Prevented button action"); } });
  assert.deepEqual(actions, []);
  keydown({ key: " ", target: { closest: () => null }, preventDefault: () => {} });
  assert.deepEqual(actions, [["next"]]);
});

test("both covers recenter during a turn and restore position after cancellation", () => {
  const callbacks = {};
  const bookEl = bookOf(Array.from({ length: 36 }, () => element()), { layout: "landscape" });
  class PageFlip {
    on(name, callback) { callbacks[name] = callback; }
    getPageCount() { return 36; }
    loadFromHTML() {}
    getRender() { return null; }
    turnToPage() {}
  }
  runInNewContext(script, {
    document: documentOf(bookEl),
    St: { PageFlip }, location: { search: "" }, URLSearchParams,
    window: windowOf(),
  });
  for (const [page, edge] of [[0, "front"], [1, "inside"], [33, "inside"], [35, "back"], [15, "inside"]]) {
    callbacks.flip({ data: page });
    for (const state of ["flipping", "user_fold"]) {
      callbacks.changeState({ data: state });
      assert.equal(bookEl.dataset.edge, "inside");
      callbacks.changeState({ data: "read" });
      assert.equal(bookEl.dataset.edge, edge);
    }
  }
});

test("chapter follows the current left page across layout changes", () => {
  const callbacks = {};
  const links = [[4, "壹德福巷"], [14, "贰唐苑"], [26, "叁钟楼"]].map(([page, name]) =>
    element({ dataset: { chapter: String(page) }, textContent: name }));
  const bookEl = bookOf(Array.from({ length: 36 }, () => element()));
  const doc = documentOf(bookEl, links);
  class PageFlip {
    on(name, callback) { callbacks[name] = callback; }
    getPageCount() { return 36; }
    loadFromHTML() {} getRender() { return null; } turnToPage() {}
  }
  runInNewContext(script, {
    document: doc,
    St: { PageFlip }, location: { search: "" }, URLSearchParams, window: windowOf(),
  });
  callbacks.init({ data: { mode: "landscape" } });
  for (const [page, chapter] of [
    [0, null], [3, null], [5, 4], [13, 4], [15, 14], [25, 14], [27, 26], [35, 26],
  ]) {
    for (const layout of ["portrait", "landscape"]) {
      // PageFlip emits flip before changeOrientation when rebuilding the spread.
      callbacks.flip({ data: page });
      callbacks.changeOrientation({ data: layout });
      assert.equal(bookEl.dataset.layout, layout);
      assert.equal(Number(doc.controls.get("#page-seek").value), page);
      assert.equal(doc.controls.get("#previous").disabled, page === 0);
      assert.equal(doc.controls.get("#next").disabled, page === 35);
      assert.equal(doc.controls.get("#page-seek").disabled, false);
      assert.deepEqual(links.filter(link => link.attributes.has("aria-current")).map(link => Number(link.dataset.chapter)), chapter === null ? [] : [chapter]);
      assert.equal(doc.controls.get("#chapter-status").textContent, chapter === null ? "长安一日" : links.find(link => Number(link.dataset.chapter) === chapter).textContent.slice(1));
      assert.equal(doc.controls.get("#page-status").textContent, page === 0 ? "封面" : page === 35 ? "封底" : `${String(page + 1).padStart(2, "0")} / 36`);
      assert.equal(doc.controls.get("#page-seek").attributes.get("aria-valuetext"), `第 ${page + 1} 页，共 36 页`);
    }
  }
  // 书脊厚度和滑条进度：这几行以前被 ?. 静默跳过，测试根本没走到
  callbacks.flip({ data: 0 });
  assert.deepEqual([bookEl.style.vars["--left-stack"], bookEl.style.vars["--right-stack"],
    doc.controls.get("#page-seek").style.vars["--read-progress"]], ["4px", "14px", "0%"]);
  callbacks.flip({ data: 35 });
  assert.deepEqual([bookEl.style.vars["--left-stack"], bookEl.style.vars["--right-stack"],
    doc.controls.get("#page-seek").style.vars["--read-progress"]], ["14px", "4px", "100%"]);
});

test("hard-cover endpoints render only the destination leaves in the correct orientation", () => {
  let orientation = "landscape";
  let spreadIndex = 0;
  let direction = 0;
  let progress = 100;
  let renderedWidth = 534;
  let ordinaryFrames = 0;
  const draws = [];
  const leaves = Array.from({ length: 36 }, (_, index) => element({
    node: { style: {} }, hideTemporaryCopy() {},
    getElement() { return this.node; }, setOrientation(side) { this.side = side; },
    simpleDraw(side) { this.node.style.display = "block"; draws.push([index, side]); },
  }));
  const landscape = [[0], ...Array.from({ length: 17 }, (_, i) => [i * 2 + 1, i * 2 + 2]), [35]];
  const portrait = leaves.map((_, i) => [i]);
  const render = {
    flippingPage: { getDrawingDensity: () => "hard" },
    getRect: () => ({ pageWidth: renderedWidth }),
    getOrientation: () => orientation, drawFrame() { ordinaryFrames++; },
  };
  const collection = {
    getPages: () => leaves, getPage: (index) => leaves[index],
    getSpread: () => orientation === "landscape" ? landscape : portrait,
    getCurrentSpreadIndex: () => spreadIndex,
  };
  class PageFlip {
    on() {} loadFromHTML() {} turnToPage() {}
    getPageCount() { return leaves.length; }
    getRender() { return render; }
    getPageCollection() { return collection; }
    getFlipController() {
      return { getCalculation: () => ({
        getDirection: () => direction, getFlippingProgress: () => progress,
      }) };
    }
  }
  const bookEl = bookOf(leaves);
  runInNewContext(script, {
    document: documentOf(bookEl),
    St: { PageFlip }, location: { search: "" }, URLSearchParams, window: windowOf(),
  });
  for (const [mode, from, turn, expected] of [
    ["landscape", 0, 0, [[1, 0], [2, 1]]], ["landscape", 1, 1, [[0, 1]]],
    ["landscape", 18, 1, [[33, 0], [34, 1]]], ["landscape", 17, 0, [[35, 0]]],
    ["portrait", 0, 0, [[1, 1]]], ["portrait", 1, 1, [[0, 1]]],
    ["portrait", 35, 1, [[34, 1]]], ["portrait", 34, 0, [[35, 1]]],
  ]) {
    orientation = mode; spreadIndex = from; direction = turn; draws.length = 0;
    render.drawFrame();
    assert.deepEqual(draws, expected);
    assert.deepEqual(leaves.flatMap((page, index) => page.node.style.display === "block" ? [index] : []), expected.map(([index]) => index));
  }
  progress = 50;
  render.drawFrame();
  assert.equal(ordinaryFrames, 1);
  for (const width of [240, 319, 534, 762]) {
    renderedWidth = width;
    progress = 100 - 0.8 / (2 * width) * 100;
    draws.length = 0;
    render.drawFrame();
    assert.deepEqual(draws, [[35, 1]], `Subpixel endpoint at width ${width}`);
    progress = 100 - 2 / (2 * width) * 100;
    draws.length = 0;
    render.drawFrame();
    assert.deepEqual(draws, [], `Still moving at width ${width}`);
  }
  render.flippingPage = { getDrawingDensity: () => "soft" };
  render.rightPage = { getDensity: () => "hard" };
  progress = 100;
  draws.length = 0;
  render.drawFrame();
  assert.deepEqual(draws, [[35, 1]], "Portrait cover turn includes the stationary hard leaf");
  render.rightPage = { getDensity: () => "soft" };
  render.bottomPage = { getDrawingDensity: () => "hard" };
  draws.length = 0;
  render.drawFrame();
  assert.deepEqual(draws, [[35, 1]], "Portrait cover turn includes the destination hard leaf");
  render.bottomPage = { getDrawingDensity: () => "soft" };
  draws.length = 0;
  render.drawFrame();
  assert.deepEqual(draws, [], "Ordinary soft pages keep their normal renderer");
});
