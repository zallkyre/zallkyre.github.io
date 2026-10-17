// droptok front end — talks to the Worker at dl.txtwall.xyz
const API = "https://dl.txtwall.xyz";
const RECENT_KEY = "droptok.recent.v1";

const $ = (sel) => document.querySelector(sel);

const ui = {
  form: $("#form"),
  url: $("#url"),
  paste: $("#pasteBtn"),
  go: $("#goBtn"),
  status: $("#status"),
  result: $("#result"),
  thumb: $("#thumb"),
  title: $("#title"),
  byline: $("#byline"),
  facts: $("#facts"),
  saveVideo: $("#saveVideo"),
  saveAudio: $("#saveAudio"),
  saveCover: $("#saveCover"),
  install: $("#install"),
  recentWrap: $("#recentWrap"),
  recent: $("#recent"),
  clear: $("#clearBtn"),
  net: $("#net"),
  toast: $("#toast"),
};

let current = null;      // resolved item
let currentLink = null;  // the link it came from
let installEvent = null;
let toastTimer = 0;

/* ---------------- helpers ---------------- */

function setStatus(text, kind = "") {
  ui.status.textContent = text || "";
  ui.status.className = "status" + (kind ? " " + kind : "");
}

function toast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 2600);
}

function fmtDuration(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ":" + String(r).padStart(2, "0");
}

function fmtSize(bytes) {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb < 1 ? Math.round(bytes / 1024) + " KB" : mb.toFixed(1) + " MB";
}

function pickLink(text) {
  const match = String(text || "").match(/https?:\/\/[^\s"'<>]+/i);
  return match ? match[0] : "";
}

function isTikTok(link) {
  return /^https?:\/\/(?:www\.|m\.|vm\.|vt\.)?tiktok\.com\//i.test(link);
}

function coverFor(link) {
  return API + "/file?url=" + encodeURIComponent(link) + "&v=cover&inline=1";
}

/* ---------------- core ---------------- */

async function resolveLink(link) {
  if (!link) {
    setStatus("Paste a TikTok link first.", "error");
    return;
  }
  if (!isTikTok(link)) {
    setStatus("That doesn't look like a TikTok link.", "error");
    return;
  }

  setStatus("Reading the video…", "busy");
  ui.go.disabled = true;
  ui.result.hidden = true;

  try {
    const res = await fetch(API + "/resolve?url=" + encodeURIComponent(link));
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "could not read that link");

    current = data;
    currentLink = link;
    showResult(data, link);
    addRecent(data, link);
    setStatus("");
  } catch (err) {
    setStatus(err.message || "something went wrong", "error");
  } finally {
    ui.go.disabled = false;
  }
}

function showResult(data, link) {
  ui.thumb.src = coverFor(link);
  ui.thumb.alt = data.title || "video cover";
  ui.title.textContent = data.title || "Untitled";
  ui.byline.textContent = [data.nickname, data.author].filter(Boolean).join("  ") ||
    (data.author || "");

  const bits = [fmtDuration(data.duration)];
  const size = fmtSize(data.size);
  if (size) bits.push(size);
  if (data.source === "tiktok") bits.push("direct");
  ui.facts.textContent = bits.filter(Boolean).join("  ·  ");

  ui.saveAudio.hidden = !data.hasAudio;
  ui.result.hidden = false;
  ui.result.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function saveFile(kind) {
  if (!currentLink) return;
  const href = API + "/file?url=" + encodeURIComponent(currentLink) + "&v=" + kind;

  // Content-Disposition on the response makes this a download rather than a
  // navigation, so the page stays put and the file lands in Downloads.
  const a = document.createElement("a");
  a.href = href;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();

  toast(kind === "audio" ? "Saving the sound…" : "Saving to your gallery…");
}

/* ---------------- recent ---------------- */

function readRecent() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeRecent(list) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 12)));
  } catch {
    /* storage full or blocked — not worth failing over */
  }
}

function addRecent(data, link) {
  const list = readRecent().filter((x) => x.link !== link);
  list.unshift({
    link,
    title: data.title || "Untitled",
    author: data.author || "",
    cover: coverFor(link),
    duration: data.duration || 0,
    size: data.size || 0,
    at: Date.now(),
  });
  writeRecent(list);
  renderRecent();
}

function renderRecent() {
  const list = readRecent();
  ui.recentWrap.hidden = list.length === 0;
  ui.recent.innerHTML = "";

  for (const item of list) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = item.title;

    const img = document.createElement("img");
    img.src = item.cover;
    img.alt = "";
    img.loading = "lazy";

    const label = document.createElement("span");
    label.textContent = item.author || item.title;

    btn.append(img, label);
    btn.addEventListener("click", () => {
      ui.url.value = item.link;
      resolveLink(item.link);
    });
    li.append(btn);
    ui.recent.append(li);
  }
}

/* ---------------- events ---------------- */

ui.form.addEventListener("submit", (event) => {
  event.preventDefault();
  resolveLink(pickLink(ui.url.value) || ui.url.value.trim());
});

ui.paste.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    const link = pickLink(text) || text.trim();
    ui.url.value = link;
    if (link) resolveLink(link);
  } catch {
    ui.url.focus();
    setStatus("Clipboard is blocked — paste manually.", "error");
  }
});

ui.saveVideo.addEventListener("click", () => saveFile("hd"));
ui.saveAudio.addEventListener("click", () => saveFile("audio"));
ui.saveCover.addEventListener("click", () => saveFile("cover"));

ui.clear.addEventListener("click", () => {
  writeRecent([]);
  renderRecent();
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installEvent = event;
  ui.install.hidden = false;
});

ui.install.addEventListener("click", async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  ui.install.hidden = true;
});

window.addEventListener("online", () => {
  ui.net.textContent = "online";
  ui.net.classList.remove("off");
});
window.addEventListener("offline", () => {
  ui.net.textContent = "offline";
  ui.net.classList.add("off");
});

/* ---------------- boot ---------------- */

function boot() {
  renderRecent();

  if (matchMedia("(display-mode: standalone)").matches || navigator.standalone) {
    ui.install.hidden = true;
  }

  if (navigator.serviceWorker) {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  }

  const params = new URLSearchParams(location.search);
  const shared = params.get("u") || params.get("text") || "";
  const link = pickLink(shared) || shared.trim();

  if (link) {
    ui.url.value = link;
    resolveLink(link);
    // Drop the query so a refresh doesn't re-download the same item.
    history.replaceState(null, "", location.pathname);
  }
}

boot();
