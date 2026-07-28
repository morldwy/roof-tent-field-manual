const checklistKey = "scandinavian-field-manual:guide-checklist";
const checkboxes = [...document.querySelectorAll("[data-check]")];

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
  vehicle: "Fahrzeug & Dachträger"
};

function escapeTip(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

async function initializeCommunity() {
  const tipsContainer = document.querySelector("#community-tips");
  const form = document.querySelector("#tip-form");
  const feedback = document.querySelector("#tip-feedback");

  try {
    const backend = window.supabase.createClient(
      window.SUPABASE_CONFIG.url,
      window.SUPABASE_CONFIG.publishableKey
    );
    let { data: sessionData } = await backend.auth.getSession();
    if (!sessionData.session) {
      const { data, error } = await backend.auth.signInAnonymously();
      if (error) throw error;
      sessionData = { session: data.session };
    }

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
        user_id: sessionData.session.user.id,
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
