const CACHE = "lastvix-gym-v26";
const FILES = ["./", "./index.html", "./manifest.json", "./admin.html", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});

/* ---------- Notifications (no server needed) ---------- */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("lvx-bg", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
function idbGet(k) {
  return idb().then((db) => new Promise((res, rej) => {
    const q = db.transaction("kv").objectStore("kv").get(k);
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  }));
}
function idbSet(k, v) {
  return idb().then((db) => new Promise((res, rej) => {
    const t = db.transaction("kv", "readwrite");
    t.objectStore("kv").put(v, k);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  }));
}
function dayNum(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "");
  return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : null;
}
function names(list) {
  const a = list.filter(Boolean);
  const shown = a.slice(0, 3).join("، ");
  return a.length > 3 ? shown + " و" + (a.length - 3) + " آخرين" : shown;
}
function buildAlert(snap, now) {
  now = now || new Date();
  const today = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  const soon = [], ended = [], bd = [];
  (snap.members || []).forEach((m) => {
    if (m.s === "frozen") return;
    const e = dayNum(m.e);
    if (e !== null) {
      const d = e - today;
      if (d >= 0 && d <= 3) soon.push(m.n);
      else if (d < 0 && d >= -3) ended.push(m.n);
    }
    const b = /^\d{4}-(\d{2})-(\d{2})/.exec(m.b || "");
    if (b && +b[1] === now.getMonth() + 1 && +b[2] === now.getDate()) bd.push(m.n);
  });
  const lines = [];
  if (soon.length) lines.push("⏳ " + soon.length + " اشتراك قرّب يخلص: " + names(soon));
  if (ended.length) lines.push("🔴 " + ended.length + " اشتراك خلص: " + names(ended));
  if (bd.length) lines.push("🎂 عيد ميلاد النهارده: " + names(bd));
  if (!lines.length) return null;
  return { title: snap.gym || "LastVix Gym", body: lines.join("\n") };
}
async function runCheck() {
  try {
    const snap = await idbGet("snapshot");
    if (!snap) return;
    const n = new Date();
    const today = n.getFullYear() + "-" + (n.getMonth() + 1) + "-" + n.getDate();
    if ((await idbGet("lastAlertDay")) === today) return;
    const a = buildAlert(snap, n);
    if (!a) return;
    await self.registration.showNotification(a.title, {
      body: a.body, icon: "icon-192.png", badge: "icon-192.png",
      dir: "rtl", lang: "ar", tag: "lvx-daily", data: { url: "./index.html" },
    });
    await idbSet("lastAlertDay", today);
  } catch (err) {}
}
self.addEventListener("periodicsync", (e) => {
  if (e.tag === "lvx-daily-check") e.waitUntil(runCheck());
});
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "lvx-test") {
    e.waitUntil(new Promise((res) => setTimeout(() => {
      self.registration.showNotification(e.data.title || "LastVix Gym", { body: e.data.body || "", icon: "icon-192.png", badge: "icon-192.png", dir: "rtl", lang: "ar", tag: "lvx-test", requireInteraction: true, vibrate: [200, 100, 200], data: { url: "./index.html" } }).then(res, res);
    }, e.data.delay || 12000)));
    return;
  }
  if (e.data === "lvx-check") e.waitUntil(runCheck());
});
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "LastVix Gym", {
    body: d.body || "", icon: "icon-192.png", badge: "icon-192.png",
    dir: "rtl", lang: "ar", data: { url: "./index.html" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) return c.focus();
      return clients.openWindow("./index.html");
    })
  );
});
