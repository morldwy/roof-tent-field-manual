const adminBackend = window.ROOF_TENT_BACKEND.client;
const authPanel = document.querySelector("#admin-auth");
const setupPanel = document.querySelector("#admin-setup");
const productsPanel = document.querySelector("#admin-products-panel");
const productsContainer = document.querySelector("#admin-products");
const adminFeedback = document.querySelector("#admin-feedback");

const categoryLabels = {
  nachtloesung: "Nachtlösung", reinigung: "Reinigung", toilette: "Toilette",
  packout: "Pack-out", sichtschutz: "Sichtschutz"
};

function productField(label, name, value, type = "text") {
  const wrapper = document.createElement("label");
  wrapper.textContent = label;
  const input = document.createElement("input");
  input.name = name;
  input.type = type;
  input.value = value ?? "";
  if (name === "url") input.pattern = "https://.*";
  wrapper.append(input);
  return wrapper;
}

function productEditor(product) {
  const form = document.createElement("form");
  form.className = "admin-panel admin-product-form";
  form.dataset.id = product.id;
  const heading = document.createElement("div");
  heading.className = "admin-product-heading";
  const title = document.createElement("h3");
  title.textContent = product.title;
  const enabledLabel = document.createElement("label");
  enabledLabel.className = "admin-switch";
  const enabled = document.createElement("input");
  enabled.type = "checkbox";
  enabled.name = "enabled";
  enabled.checked = product.enabled;
  enabledLabel.append(enabled, document.createTextNode(" Aktiv"));
  heading.append(title, enabledLabel);
  form.append(
    heading,
    productField("Titel", "title", product.title),
    productField("Empfehlung", "recommendation", product.recommendation)
  );
  const category = document.createElement("label");
  category.textContent = "Kategorie";
  const select = document.createElement("select");
  select.name = "category";
  Object.entries(categoryLabels).forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = value === product.category;
    select.append(option);
  });
  category.append(select);
  form.append(
    category,
    productField("Bezug-URL", "url", product.url, "url"),
    productField("Bewertungsnotiz", "rating_note", product.rating_note),
    productField("Sortierung", "sort_order", product.sort_order, "number")
  );
  const actions = document.createElement("div");
  actions.className = "admin-actions";
  const save = document.createElement("button");
  save.type = "submit";
  save.textContent = "Speichern";
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "danger-button";
  remove.textContent = "Löschen";
  remove.addEventListener("click", () => deleteProduct(product.id, product.title));
  actions.append(save, remove);
  form.append(actions);
  enabled.addEventListener("change", () => updateProduct(product.id, { enabled: enabled.checked }, `${product.title} ${enabled.checked ? "aktiviert" : "deaktiviert"}.`));
  form.addEventListener("submit", event => saveProduct(event, product.id));
  return form;
}

async function loadAdminProducts() {
  const { data, error } = await adminBackend.from("guide_products").select("*").order("sort_order", { ascending: true });
  if (error) throw error;
  productsContainer.innerHTML = "";
  data.forEach(product => productsContainer.append(productEditor(product)));
}

async function updateProduct(id, values, message) {
  adminFeedback.textContent = "Wird gespeichert …";
  const { error } = await adminBackend.from("guide_products").update({ ...values, updated_at: new Date().toISOString() }).eq("id", id);
  adminFeedback.textContent = error ? `Fehler: ${error.message}` : message;
  if (!error) await loadAdminProducts();
}

async function saveProduct(event, id) {
  event.preventDefault();
  const form = event.currentTarget;
  await updateProduct(id, {
    title: form.elements.title.value.trim(),
    recommendation: form.elements.recommendation.value.trim(),
    category: form.elements.category.value,
    url: form.elements.url.value.trim(),
    rating_note: form.elements.rating_note.value.trim(),
    sort_order: Number(form.elements.sort_order.value),
    enabled: form.elements.enabled.checked
  }, "Änderungen gespeichert.");
}

async function deleteProduct(id, title) {
  if (!confirm(`„${title}“ wirklich löschen? Deaktivieren ist meist die bessere Wahl.`)) return;
  const { error } = await adminBackend.from("guide_products").delete().eq("id", id);
  adminFeedback.textContent = error ? `Fehler: ${error.message}` : "Bezugstipp gelöscht.";
  if (!error) await loadAdminProducts();
}

async function renderAdmin(session) {
  const user = session?.user;
  const isSignedIn = user && !user.is_anonymous && user.email;
  authPanel.hidden = Boolean(isSignedIn);
  setupPanel.hidden = true;
  productsPanel.hidden = true;
  if (!isSignedIn) return;
  const { data, error } = await adminBackend.from("app_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (error || !data) {
    setupPanel.hidden = false;
    document.querySelector("#admin-setup-sql").textContent = `insert into public.app_admins (user_id) values ('${user.id}');`;
    return;
  }
  productsPanel.hidden = false;
  await loadAdminProducts();
}

document.querySelector("#admin-login").addEventListener("submit", async event => {
  event.preventDefault();
  const email = event.currentTarget.elements.email.value.trim();
  const feedback = document.querySelector("#admin-auth-feedback");
  feedback.textContent = "Anmeldelink wird gesendet …";
  const redirect = new URL("admin.html", location.href).href;
  const { error } = await adminBackend.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
  feedback.textContent = error ? `Fehler: ${error.message}` : "Anmeldelink gesendet. Bitte E-Mail öffnen.";
});

document.querySelector("#copy-admin-sql").addEventListener("click", async () => {
  await navigator.clipboard.writeText(document.querySelector("#admin-setup-sql").textContent);
  document.querySelector("#copy-admin-sql").textContent = "Kopiert";
});

document.querySelector("#admin-signout").addEventListener("click", async () => {
  await adminBackend.auth.signOut();
  location.reload();
});

document.querySelector("#new-product").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = {
    product_key: form.elements.product_key.value.trim(),
    title: form.elements.title.value.trim(),
    recommendation: form.elements.recommendation.value.trim(),
    category: form.elements.category.value,
    url: form.elements.url.value.trim(),
    rating_note: form.elements.rating_note.value.trim(),
    sort_order: Number(form.elements.sort_order.value),
    enabled: form.elements.enabled.checked
  };
  const { error } = await adminBackend.from("guide_products").insert(values);
  adminFeedback.textContent = error ? `Fehler: ${error.message}` : "Bezugstipp angelegt.";
  if (!error) {
    form.reset();
    await loadAdminProducts();
  }
});

adminBackend.auth.getSession().then(({ data }) => renderAdmin(data.session));
adminBackend.auth.onAuthStateChange((_event, session) => renderAdmin(session));
