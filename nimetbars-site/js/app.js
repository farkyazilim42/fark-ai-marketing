(function () {
  "use strict";

  const S = window.SITE;
  const CATS = window.CATEGORIES;
  const PRODUCTS = window.PRODUCTS;
  const catById = Object.fromEntries(CATS.map((c) => [c.id, c]));
  const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
  const img = (name) => `assets/products/${name}.jpg`;
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => s.toLocaleLowerCase("tr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i");

  const waLink = (text) => `https://wa.me/${S.whatsapp}?text=${encodeURIComponent(text)}`;
  const productMsg = (p) => `Merhaba, "${p.name}" (${p.id.toUpperCase()}) ürünü hakkında bilgi almak istiyorum.`;

  // Brand / contact placeholders
  document.querySelectorAll("[data-brand]").forEach((el) => (el.textContent = S.brand));
  document.querySelectorAll("[data-tagline]").forEach((el) => (el.textContent = S.tagline));
  document.querySelectorAll("[data-phone]").forEach((el) => (el.textContent = S.phoneDisplay));
  document.querySelectorAll("[data-email]").forEach((el) => { el.textContent = S.email; el.href = `mailto:${S.email}`; });
  document.querySelectorAll("[data-city]").forEach((el) => (el.textContent = S.city));
  document.querySelectorAll("[data-count-products]").forEach((el) => (el.textContent = PRODUCTS.length));
  document.querySelectorAll("[data-wa]").forEach((el) => {
    el.href = waLink(el.dataset.wa);
    el.target = "_blank";
    el.rel = "noopener";
  });
  $("#year").textContent = new Date().getFullYear();

  // Mobile nav
  const nav = $("#nav");
  const toggle = $("#menuToggle");
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open);
    document.body.classList.toggle("nav-open", open);
  });
  nav.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("nav-open");
    }
  });
  const header = $(".site-header");
  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 10);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Inquiry list (persisted)
  const LIST_KEY = "nb-inquiry-list";
  let list = [];
  try { list = JSON.parse(localStorage.getItem(LIST_KEY) || "[]").filter((id) => byId[id]); } catch (_) { list = []; }
  const saveList = () => { try { localStorage.setItem(LIST_KEY, JSON.stringify(list)); } catch (_) {} };
  const inList = (id) => list.includes(id);
  function toggleList(id) {
    list = inList(id) ? list.filter((x) => x !== id) : [...list, id];
    saveList();
    syncList();
  }
  function syncList() {
    const n = list.length;
    const badge = $("#listCount");
    badge.textContent = n;
    badge.hidden = n === 0;
    document.querySelectorAll("[data-save]").forEach((b) => {
      const on = inList(b.dataset.save);
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on);
      b.setAttribute("aria-label", on ? "Talep listesinden çıkar" : "Talep listesine ekle");
    });
    if (current) $("#mList").textContent = inList(current.id) ? "Listeden Çıkar" : "Talep Listeme Ekle";
    $("#listItems").innerHTML = list.map((id) => {
      const p = byId[id];
      return `<li><img src="${img(p.images[0])}" alt="" /><div><strong>${esc(p.name)}</strong><small>${esc(catById[p.cat].name)}</small></div><button data-remove="${id}" aria-label="Kaldır">×</button></li>`;
    }).join("");
    $("#listEmpty").hidden = n > 0;
    const send = $("#listSend");
    send.classList.toggle("disabled", n === 0);
    send.href = n ? waLink(`Merhaba, aşağıdaki ürünler hakkında bilgi almak istiyorum:\n${list.map((id, i) => `${i + 1}. ${byId[id].name} (${id.toUpperCase()})`).join("\n")}`) : "#";
  }
  $("#listItems").addEventListener("click", (e) => {
    const id = e.target.dataset.remove;
    if (id) toggleList(id);
  });
  $("#openList").addEventListener("click", () => $("#listDrawer").showModal());

  // Categories
  const counts = PRODUCTS.reduce((m, p) => ((m[p.cat] = (m[p.cat] || 0) + 1), m), {});
  $("#catGrid").innerHTML = CATS.map((c) => `
    <a class="cat-card" href="#koleksiyon" data-cat="${c.id}">
      <div class="cat-media"><img src="${img(c.cover)}" alt="${esc(c.name)}" loading="lazy" /></div>
      <div class="cat-info"><h3>${esc(c.name)}</h3><p>${esc(c.blurb)}</p><span>${counts[c.id] || 0} model →</span></div>
    </a>`).join("");

  // Filters
  let activeCat = "all";
  let query = "";
  const chips = $("#chips");
  chips.innerHTML = [{ id: "all", short: "Tümü" }, ...CATS].map((c) =>
    `<button role="tab" class="chip" data-filter="${c.id}" aria-selected="${c.id === "all"}">${esc(c.short)} <small>${c.id === "all" ? PRODUCTS.length : counts[c.id] || 0}</small></button>`
  ).join("");
  chips.addEventListener("click", (e) => {
    const b = e.target.closest("[data-filter]");
    if (b) setCat(b.dataset.filter);
  });
  $("#catGrid").addEventListener("click", (e) => {
    const a = e.target.closest("[data-cat]");
    if (a) setCat(a.dataset.cat);
  });
  function setCat(id) {
    activeCat = id;
    chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-selected", c.dataset.filter === id));
    render();
  }
  let t;
  $("#search").addEventListener("input", (e) => {
    clearTimeout(t);
    t = setTimeout(() => { query = norm(e.target.value.trim()); render(); }, 120);
  });

  // Grid
  const grid = $("#grid");
  function card(p) {
    const c = catById[p.cat];
    return `
      <article class="card" data-open="${p.id}">
        <button class="card-media" data-open="${p.id}" aria-label="${esc(p.name)} detaylarını gör">
          <img src="${img(p.images[0])}" alt="${esc(p.name)}" loading="lazy" decoding="async" />
          ${p.images.length > 1 ? `<span class="pill">${p.images.length} görsel</span>` : ""}
        </button>
        <button class="save" data-save="${p.id}" aria-pressed="false" aria-label="Talep listesine ekle">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>
        </button>
        <div class="card-body">
          <p class="card-cat">${esc(c.short)} · ${esc(p.stone)}</p>
          <h3 class="card-title">${esc(p.name)}</h3>
          <p class="card-sum">${esc(p.summary)}</p>
          <div class="card-actions">
            <button class="btn btn-sm btn-ghost" data-open="${p.id}">İncele</button>
            <a class="btn btn-sm btn-primary" href="${waLink(productMsg(p))}" target="_blank" rel="noopener">Bilgi Al</a>
          </div>
        </div>
      </article>`;
  }
  function render() {
    const items = PRODUCTS.filter((p) => {
      if (activeCat !== "all" && p.cat !== activeCat) return false;
      if (!query) return true;
      return norm([p.name, p.stone, p.summary, catById[p.cat].name].join(" ")).includes(query);
    });
    grid.innerHTML = items.map(card).join("");
    $("#empty").hidden = items.length > 0;
    $("#resultCount").textContent = `${items.length} ürün gösteriliyor`;
    syncList();
  }
  grid.addEventListener("click", (e) => {
    const s = e.target.closest("[data-save]");
    if (s) { e.stopPropagation(); toggleList(s.dataset.save); return; }
    if (e.target.closest("a")) return;
    const o = e.target.closest("[data-open]");
    if (o) openProduct(o.dataset.open);
  });

  // Product modal
  const modal = $("#productModal");
  let current = null;
  let imgIdx = 0;
  function showImage(i) {
    const n = current.images.length;
    imgIdx = (i + n) % n;
    const main = $("#mImage");
    main.src = img(current.images[imgIdx]);
    main.alt = `${current.name} – görsel ${imgIdx + 1}`;
    $("#mThumbs").querySelectorAll("button").forEach((b, k) => b.setAttribute("aria-current", k === imgIdx));
  }
  function openProduct(id, push = true) {
    const p = byId[id];
    if (!p) return;
    current = p;
    $("#mCat").textContent = catById[p.cat].name;
    $("#mTitle").textContent = p.name;
    $("#mDesc").textContent = p.desc;
    const specs = [["Malzeme", p.stone], ["Yüzey", p.finish], ["Ölçü", p.sizes || "Talebe göre üretilebilir"], ["Ürün kodu", p.id.toUpperCase()]];
    $("#mSpecs").innerHTML = specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("");
    $("#mFeatures").innerHTML = p.features.map((f) => `<li>${esc(f)}</li>`).join("");
    $("#mThumbs").innerHTML = p.images.length > 1 ? p.images.map((im, k) => `<button data-idx="${k}" aria-label="Görsel ${k + 1}"><img src="${img(im)}" alt="" /></button>`).join("") : "";
    modal.classList.toggle("single", p.images.length < 2);
    $("#mWa").href = waLink(productMsg(p));
    showImage(0);
    syncList();
    if (!modal.open) modal.showModal();
    if (push && location.hash !== `#urun-${id}`) history.pushState(null, "", `#urun-${id}`);
  }
  function closeModal() {
    if (modal.open) modal.close();
  }
  modal.addEventListener("close", () => {
    current = null;
    if (location.hash.startsWith("#urun-")) history.pushState(null, "", location.pathname + location.search + "#koleksiyon");
  });
  $("#mThumbs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-idx]");
    if (b) showImage(+b.dataset.idx);
  });
  $("#gPrev").addEventListener("click", () => showImage(imgIdx - 1));
  $("#gNext").addEventListener("click", () => showImage(imgIdx + 1));
  $("#mList").addEventListener("click", () => current && toggleList(current.id));
  modal.addEventListener("keydown", (e) => {
    if (!current) return;
    if (e.key === "ArrowLeft") showImage(imgIdx - 1);
    if (e.key === "ArrowRight") showImage(imgIdx + 1);
  });
  let touchX = null;
  $(".gallery-main").addEventListener("touchstart", (e) => (touchX = e.touches[0].clientX), { passive: true });
  $(".gallery-main").addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) showImage(imgIdx + (dx < 0 ? 1 : -1));
    touchX = null;
  });

  document.querySelectorAll("dialog").forEach((d) => {
    d.addEventListener("click", (e) => {
      if (e.target === d || e.target.closest("[data-close]")) d.close();
    });
  });

  function fromHash() {
    const m = location.hash.match(/^#urun-(p\d+)$/);
    if (m) openProduct(m[1], false);
    else closeModal();
  }
  window.addEventListener("popstate", fromHash);

  // Contact form → WhatsApp
  const select = $("#productSelect");
  CATS.forEach((c) => {
    const g = document.createElement("optgroup");
    g.label = c.name;
    PRODUCTS.filter((p) => p.cat === c.id).forEach((p) => g.append(new Option(p.name, p.id)));
    select.append(g);
  });
  $("#contactForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    if (!f.reportValidity()) return;
    const d = Object.fromEntries(new FormData(f));
    const lines = [`Merhaba, ben ${d.name}.`];
    if (d.product) lines.push(`İlgilendiğim ürün: ${byId[d.product].name} (${d.product.toUpperCase()})`);
    lines.push(d.message);
    if (d.phone) lines.push(`Telefon: ${d.phone}`);
    window.open(waLink(lines.join("\n")), "_blank", "noopener");
  });

  render();
  fromHash();
})();
