const checklistKey = "roof-tent-field-manual:guide-checklist";
const previousChecklistKey = "scandinavian-field-manual:guide-checklist";
const checkboxes = [...document.querySelectorAll("[data-check]")];

if (!localStorage.getItem(checklistKey) && localStorage.getItem(previousChecklistKey)) {
  localStorage.setItem(checklistKey, localStorage.getItem(previousChecklistKey));
  localStorage.removeItem(previousChecklistKey);
}

function storedChecks() {
  try {
    return JSON.parse(localStorage.getItem(checklistKey)) || {};
  } catch {
    return {};
  }
}

function updateProgress() {
  const completed = checkboxes.filter(box => box.checked).length;
  const percent = checkboxes.length ? completed / checkboxes.length * 100 : 0;
  document.querySelector("#check-progress-bar").style.width = `${percent}%`;
  document.querySelector("#check-progress-text").textContent = `${completed} von ${checkboxes.length} erledigt`;
}

const saved = storedChecks();
checkboxes.forEach(box => {
  box.checked = Boolean(saved[box.dataset.check]);
  box.addEventListener("change", () => {
    const current = storedChecks();
    current[box.dataset.check] = box.checked;
    localStorage.setItem(checklistKey, JSON.stringify(current));
    updateProgress();
  });
});

document.querySelector("#reset-checklists").addEventListener("click", () => {
  checkboxes.forEach(box => { box.checked = false; });
  localStorage.removeItem(checklistKey);
  updateProgress();
});

updateProgress();

const topicNames = {
  setup: "Aufbau & Abbau",
  weather: "Wetter & Schlafklima",
  gear: "Ausrüstung",
  location: "Platzwahl & Rücksicht",
  vehicle: "Fahrzeug & Dachträger",
  sanitation: "Sanitär & Hygiene"
};

function escapeTip(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

const productCategoryNames = {
  nachtloesung: "Nachtlösung",
  reinigung: "Reinigung",
  toilette: "Toilette",
  packout: "Pack-out",
  sichtschutz: "Sichtschutz",
  cooking: "Kochen",
  water: "Wasser",
  lighting: "Licht",
  sleep: "Schlafen",
  safety: "Sicherheit",
  storage: "Aufbewahrung"
};

const sanitationProductCategories = new Set(["nachtloesung", "reinigung", "toilette", "packout", "sichtschutz"]);

function safeProductUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

async function loadProductRecommendations(backend) {
  const section = document.querySelector("#product-recommendations");
  const container = document.querySelector("#guide-products");
  const gearSection = document.querySelector("#gear-recommendations");
  const gearContainer = document.querySelector("#guide-gear-products");
  if (!section || !container || !gearSection || !gearContainer) return;
  const { data, error } = await backend
    .from("guide_products")
    .select("id,title,recommendation,category,url,rating_note,sort_order")
    .eq("enabled", true)
    .order("sort_order", { ascending: true });
  if (error) {
    section.hidden = true;
    gearSection.hidden = true;
    return;
  }
  container.innerHTML = "";
  gearContainer.innerHTML = "";
  (data || []).forEach(product => {
    const href = safeProductUrl(product.url);
    if (!href) return;
    const card = document.createElement("article");
    const category = document.createElement("span");
    category.textContent = productCategoryNames[product.category] || "Ausrüstung";
    const title = document.createElement("h4");
    title.textContent = product.title;
    const recommendation = document.createElement("p");
    recommendation.textContent = product.recommendation;
    const rating = document.createElement("small");
    rating.textContent = product.rating_note;
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer nofollow";
    link.textContent = "Bezug prüfen ↗";
    card.append(category, title, recommendation, rating, link);
    (sanitationProductCategories.has(product.category) ? container : gearContainer).append(card);
  });
  if (!container.children.length) section.hidden = true;
  if (!gearContainer.children.length) gearSection.hidden = true;
}

function sourceLink(source) {
  const href = safeProductUrl(source.url);
  if (!href) return null;
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  const label = document.createElement("span");
  label.textContent = source.label;
  const title = document.createElement("strong");
  title.textContent = source.title;
  const description = document.createElement("small");
  description.textContent = source.description;
  link.append(label, title, description);
  return link;
}

function sourceVideo(source) {
  const href = safeProductUrl(source.url);
  const imageUrl = safeProductUrl(source.image_url);
  if (!href || !imageUrl) return null;
  const card = document.createElement("article");
  card.className = "video-card";
  const preview = document.createElement("a");
  preview.className = "video-preview";
  preview.href = href;
  preview.target = "_blank";
  preview.rel = "noopener noreferrer";
  preview.setAttribute("aria-label", `${source.title} ansehen`);
  const image = document.createElement("img");
  image.src = imageUrl;
  image.alt = "";
  image.width = 480;
  image.height = 360;
  image.loading = "lazy";
  image.decoding = "async";
  const play = document.createElement("span");
  play.className = "play-button";
  play.setAttribute("aria-hidden", "true");
  play.textContent = "▶";
  preview.append(image, play);
  const copy = document.createElement("div");
  const label = document.createElement("span");
  label.textContent = source.label;
  const title = document.createElement("h3");
  title.textContent = source.title;
  const description = document.createElement("p");
  description.textContent = source.description;
  copy.append(label, title, description);
  card.append(preview, copy);
  return card;
}

async function loadGuideSources(backend) {
  const { data, error } = await backend
    .from("guide_sources")
    .select("id,section,label,title,description,url,image_url,sort_order")
    .eq("enabled", true)
    .order("sort_order", { ascending: true });
  if (error) return;
  ["sanitation", "media_video", "media_resource"].forEach(section => {
    const container = document.querySelector(`#guide-sources-${section.replace("_", "-")}`);
    if (!container) return;
    container.innerHTML = "";
    data.filter(source => source.section === section).forEach(source => {
      const element = section === "media_video" ? sourceVideo(source) : sourceLink(source);
      if (element) container.append(element);
    });
  });
}

async function initializeCommunity() {
  const tipsContainer = document.querySelector("#community-tips");
  const form = document.querySelector("#tip-form");
  const feedback = document.querySelector("#tip-feedback");

  try {
    const backend = window.ROOF_TENT_BACKEND.client;
    loadProductRecommendations(backend);
    loadGuideSources(backend);
    const session = await window.ROOF_TENT_BACKEND.ensureAnonymousSession();

    const { data: tips, error: tipsError } = await backend
      .from("guide_tips")
      .select("id,section,body,created_at")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(24);
    if (tipsError) throw tipsError;
    tipsContainer.innerHTML = tips.length
      ? tips.map(tip => `
          <article>
            <span>${escapeTip(topicNames[tip.section] || "Praxistipp")}</span>
            <p>${escapeTip(tip.body).replace(/\n/g, "<br>")}</p>
          </article>`).join("")
      : '<p class="empty">Noch keine freigegebenen Tipps. Du kannst den ersten Beitrag einreichen.</p>';

    form.addEventListener("submit", async event => {
      event.preventDefault();
      const submit = form.querySelector(".submit-tip");
      const section = form.elements.section.value;
      const body = form.elements.body.value.trim();
      if (body.length < 15) return;
      submit.disabled = true;
      feedback.textContent = "Tipp wird gespeichert …";
      const { error } = await backend.from("guide_tips").insert({
        user_id: session.user.id,
        section,
        body
      });
      submit.disabled = false;
      if (error) {
        feedback.textContent = "Der Tipp konnte gerade nicht gespeichert werden. Bitte versuche es später erneut.";
        return;
      }
      form.reset();
      feedback.textContent = "Danke! Dein Tipp wartet jetzt auf die redaktionelle Prüfung.";
    });
  } catch {
    tipsContainer.innerHTML = '<p class="empty">Community-Tipps sind vorübergehend nicht erreichbar.</p>';
    form.hidden = true;
  }
}

initializeCommunity();
