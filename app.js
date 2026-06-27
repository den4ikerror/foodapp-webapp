// ====== НАЛАШТУВАННЯ ======
// Встав сюди адресу свого backend після деплою (без слеша в кінці)
const API_URL = "https://foodapp-backend.dengor354.workers.dev/";

const STORAGE_KEY = "tarilka_entries_v1";

// ====== НАВІГАЦІЯ ======
const views = {};
document.querySelectorAll(".view").forEach((v) => (views[v.id] = v));

function showView(id) {
  Object.values(views).forEach((v) => v.classList.remove("view--active"));
  views[id].classList.add("view--active");
  document.querySelectorAll(".navbar__item").forEach((b) => {
    b.classList.toggle("is-active", b.dataset.target === id);
  });
  window.scrollTo(0, 0);
}

document.querySelectorAll(".navbar__item").forEach((btn) => {
  btn.addEventListener("click", () => {
    showView(btn.dataset.target);
    if (btn.dataset.target === "view-history") renderHistory();
  });
});

document.getElementById("btn-go-analyze").addEventListener("click", () => {
  resetAnalyzeForm();
  showView("view-analyze");
});
document.getElementById("btn-back-from-analyze").addEventListener("click", () => showView("view-home"));
document.getElementById("btn-back-from-result").addEventListener("click", () => showView("view-home"));
document.getElementById("btn-result-done").addEventListener("click", () => showView("view-home"));
document.getElementById("btn-back-from-detail").addEventListener("click", () => showView("view-history"));

// ====== ФОТО ======
const photoBox = document.getElementById("photo-box");
const photoInput = document.getElementById("photo-input");
const photoPreview = document.getElementById("photo-preview");
const photoPlaceholder = document.getElementById("photo-placeholder");
const btnRemovePhoto = document.getElementById("btn-remove-photo");

let currentPhotoBase64 = null;

photoBox.addEventListener("click", () => photoInput.click());

photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    currentPhotoBase64 = dataUrl.split(",")[1];
    photoPreview.src = dataUrl;
    photoPreview.hidden = false;
    photoPlaceholder.hidden = true;
    btnRemovePhoto.hidden = false;
  };
  reader.readAsDataURL(file);
});

btnRemovePhoto.addEventListener("click", (e) => {
  e.stopPropagation();
  currentPhotoBase64 = null;
  photoInput.value = "";
  photoPreview.hidden = true;
  photoPlaceholder.hidden = false;
  btnRemovePhoto.hidden = true;
});

function resetAnalyzeForm() {
  currentPhotoBase64 = null;
  photoInput.value = "";
  photoPreview.hidden = true;
  photoPlaceholder.hidden = false;
  btnRemovePhoto.hidden = true;
  document.getElementById("text-input").value = "";
}

// ====== АНАЛІЗ ======
document.getElementById("btn-submit-analysis").addEventListener("click", async () => {
  const text = document.getElementById("text-input").value.trim();

  if (!text && !currentPhotoBase64) {
    alert("Додай фото або опиши, що ти з'їв(-ла) 🙂");
    return;
  }

  showView("view-loading");

  try {
    const res = await fetch(`${API_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text || null,
        image_base64: currentPhotoBase64 || null,
      }),
    });

    if (!res.ok) throw new Error("Server error " + res.status);
    const data = await res.json();

    const entry = {
      id: Date.now(),
      date: new Date().toISOString(),
      photo: currentPhotoBase64 ? `data:image/jpeg;base64,${currentPhotoBase64}` : null,
      ...data,
    };
    saveEntry(entry);
    renderReceipt(document.getElementById("receipt-card"), entry);
    showView("view-result");
  } catch (err) {
    console.error(err);
    showView("view-analyze");
    alert("Не вдалося проаналізувати 😕 Перевір інтернет і спробуй ще раз.");
  }
});

// ====== ЧЕК-КАРТКА ======
function renderReceipt(container, e) {
  const kcal =
    e.calories_min != null && e.calories_max != null
      ? `${e.calories_min}–${e.calories_max}`
      : "—";

  container.innerHTML = `
    <div class="receipt__name">${escapeHtml(e.name || "Невідома страва")}</div>
    <div class="receipt__confidence">${confidenceLabel(e.confidence)}</div>

    <div class="receipt__kcal-label">Калорійність, ккал</div>
    <div class="receipt__kcal">${kcal}</div>

    <div class="receipt__macros">
      ${macroBox(e.protein_g, "Білки")}
      ${macroBox(e.fat_g, "Жири")}
      ${macroBox(e.carbs_g, "Вугл.")}
    </div>

    <div class="receipt__divider"></div>

    <div class="receipt__reco-label">Рекомендація</div>
    <div class="receipt__reco">${escapeHtml(e.recommendation || "—")}</div>

    <div class="receipt__meta">${formatDateTime(e.date)}</div>
  `;
}

function macroBox(val, label) {
  return `<div class="macro"><div class="macro__val">${val != null ? val + "г" : "—"}</div><div class="macro__label">${label}</div></div>`;
}

function confidenceLabel(c) {
  if (c === "high") return "Висока точність оцінки";
  if (c === "low") return "Оцінка орієнтовна";
  return "Середня точність оцінки";
}

// ====== ЛОКАЛЬНЕ ЗБЕРЕЖЕННЯ ======
function getEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveEntry(entry) {
  const entries = getEntries();
  entries.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function deleteEntry(id) {
  const entries = getEntries().filter((e) => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// ====== ІСТОРІЯ ======
function renderHistory() {
  const list = document.getElementById("history-list");
  const entries = getEntries();

  if (entries.length === 0) {
    list.innerHTML = `<div class="history__empty">Тут з'явиться все, що ти проаналізуєш 🍴</div>`;
    return;
  }

  const groups = {};
  entries.forEach((e) => {
    const label = dayLabel(e.date);
    groups[label] = groups[label] || [];
    groups[label].push(e);
  });

  list.innerHTML = Object.entries(groups)
    .map(
      ([label, items]) => `
      <div class="history__group-label">${label}</div>
      ${items
        .map(
          (e) => `
        <button class="history__item" data-id="${e.id}">
          <div>
            <div class="history__item-name">${escapeHtml(e.name || "Невідома страва")}</div>
            <div class="history__item-time">${formatTime(e.date)}</div>
          </div>
          <div class="history__item-kcal">${e.calories_min != null ? e.calories_min + "–" + e.calories_max : "—"}</div>
        </button>`
        )
        .join("")}
    `
    )
    .join("");

  list.querySelectorAll(".history__item").forEach((btn) => {
    btn.addEventListener("click", () => openDetail(Number(btn.dataset.id)));
  });
}

function openDetail(id) {
  const entry = getEntries().find((e) => e.id === id);
  if (!entry) return;
  renderReceipt(document.getElementById("detail-card"), entry);
  document.getElementById("btn-delete-entry").onclick = () => {
    if (confirm("Видалити цей запис?")) {
      deleteEntry(id);
      showView("view-history");
      renderHistory();
    }
  };
  showView("view-detail");
}

// ====== ХЕЛПЕРИ ======
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString("uk-UA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a, b) => a.toDateString() === b.toDateString();

  if (isSameDay(d, today)) return "Сьогодні";
  if (isSameDay(d, yesterday)) return "Учора";
  return d.toLocaleDateString("uk-UA", { day: "numeric", month: "long" });
}

// ====== SERVICE WORKER ======
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
