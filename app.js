const curatedSpots = [
  {
    id: "hessenstein", name: "Hessenstein & Panker", type: "wald", icon: "🌲",
    lat: 54.3308, lng: 10.5759, access: "Normaler Pkw · befestigte Zufahrt",
    status: "amber", label: "Erlaubnis nötig",
    note: "Wald- und Aussichtsziel zum Scouten. Keine dokumentierte Übernachtungserlaubnis; Schutz- und Privatflächen respektieren."
  },
  {
    id: "hubertsberg", name: "Küste bei Hubertsberg", type: "meer", icon: "🌊",
    lat: 54.3667, lng: 10.5982, access: "Normaler Pkw · letzte Meter prüfen",
    status: "red", label: "Nur Tagesbesuch",
    note: "Ruhiger Küstenabschnitt für Frühstück und Spaziergang. Geplante Übernachtung nur auf einer ausdrücklich freigegebenen Privatfläche."
  },
  {
    id: "puelsen", name: "Selenter See bei Pülsen", type: "see", icon: "🦆",
    lat: 54.2867, lng: 10.4412, access: "Normaler Pkw · öffentliche Wege",
    status: "red", label: "Nur Tagesbesuch",
    note: "Schöner Morgenplatz am See. Badestelle und öffentlicher Parkplatz sind keine automatische Übernachtungserlaubnis."
  },
  {
    id: "behrensdorf", name: "Hohwachter Bucht", type: "meer", icon: "🌅",
    lat: 54.3456, lng: 10.6668, access: "Normaler Pkw · küstennah",
    status: "amber", label: "Privatfläche suchen",
    note: "Aussichtsreiche Scout-Region. Geeignet sind ausschließlich Flächen, deren Eigentümer eine einzelne Nacht vorher erlaubt."
  },
  {
    id: "hohenfelde", name: "Küstenland Hohenfelde", type: "meer", icon: "🌊",
    lat: 54.3710, lng: 10.4890, access: "Normaler Pkw · Zufahrt vor Ort klären",
    status: "amber", label: "Erlaubnis nötig",
    note: "Landwirtschaftlich geprägte Küstenregion. Direkt bei einem Hof nach einer ruhigen Einzelübernachtung fragen."
  },
  {
    id: "selent", name: "Waldrand bei Selent", type: "wald", icon: "🌲",
    lat: 54.2915, lng: 10.4185, access: "Normaler Pkw · nicht in Forstwege fahren",
    status: "amber", label: "Erlaubnis nötig",
    note: "Scout-Gebiet nahe Wald und See. Nur ausgewiesene Straßen nutzen und vor einer Übernachtung die Eigentümerzustimmung dokumentieren."
  }
];

let spots = [...curatedSpots];

const colors = { green: "#2e7d55", amber: "#d58a21", red: "#b64b3b" };
const map = L.map("map", { zoomControl: false }).setView([54.325, 10.56], 11);
L.control.zoom({ position: "bottomright" }).addTo(map);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const markers = new Map();
const detailDialog = document.querySelector("#spot-detail");
const detailContent = document.querySelector("#detail-content");
const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });
let activeFilter = "all";
let activePermissionFilter = "all";
let activeSpotId = null;
let searchRadius = Number(document.querySelector("#search-radius").value);
let searchTimer = null;
let searchSequence = 0;
let searchCenter = { lat: 54.325, lng: 10.56 };
let selectedLocationPin = null;

const backend = window.supabase.createClient(
  window.SUPABASE_CONFIG.url,
  window.SUPABASE_CONFIG.publishableKey
);
const state = { ratings: {}, ratingCounts: {}, comments: {}, user: null, ready: false };

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function markerIcon(spot) {
  return L.divIcon({
    className: "",
    html: `<span class="spot-marker" style="background:${colors[spot.status]}">${spot.icon}</span>`,
    iconSize: [32, 32], iconAnchor: [16, 16]
  });
}

function popupRating(spotId) {
  const rating = Number(state.ratings[spotId] || 0);
  const count = Number(state.ratingCounts[spotId] || 0);
  const rounded = Math.round(rating);
  const label = rating
    ? `${rating} von 5 Sternen · ${count} Bewertung${count === 1 ? "" : "en"}`
    : "Noch nicht bewertet";
  return `
    <div class="popup-rating" aria-label="${label}" title="${label}">
      <span>${[1, 2, 3, 4, 5].map(value => `<i class="${value <= rounded ? "filled" : ""}">★</i>`).join("")}</span>
      <small>${rating ? `${rating} (${count})` : "Noch offen"}</small>
    </div>`;
}

function popupMarkup(spot) {
  const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`;
  return `
    <div class="map-popup">
      <div class="map-popup-title">
        <strong>${spot.icon} ${escapeHtml(spot.name)}</strong>
        <i class="status-dot ${spot.status}" title="${escapeHtml(spot.label)}"></i>
      </div>
      <small>${escapeHtml(spot.access)}</small>
      ${popupRating(spot.id)}
      <div class="map-popup-actions">
        <button type="button" data-popup-detail="${spot.id}">Details</button>
        <button type="button" data-popup-comments="${spot.id}">Kommentare</button>
        <a href="${navigationUrl}" target="_blank" rel="noopener">Navigation ↗</a>
      </div>
    </div>`;
}

function addMarker(spot) {
  const marker = L.marker([spot.lat, spot.lng], { icon: markerIcon(spot) })
    .bindPopup(popupMarkup(spot), { minWidth: 245 })
    .addTo(map);
  markers.set(spot.id, marker);
}

function syncMarkers() {
  const currentIds = new Set(spots.map(spot => spot.id));
  for (const [id, marker] of markers) {
    if (!currentIds.has(id)) {
      marker.remove();
      markers.delete(id);
    }
  }
  spots.forEach(spot => {
    if (!markers.has(spot.id)) addMarker(spot);
  });
}

function distanceKm(a, b) {
  const earthRadius = 6371;
  const radians = value => value * Math.PI / 180;
  const deltaLat = radians(b.lat - a.lat);
  const deltaLng = radians(b.lng - a.lng);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function visibleSearchArea(center) {
  const mapBounds = map.getBounds();
  const latDelta = searchRadius / 111000;
  const lngDelta = searchRadius / (111000 * Math.max(.2, Math.cos(center.lat * Math.PI / 180)));
  return {
    south: Math.min(mapBounds.getSouth(), center.lat - latDelta),
    north: Math.max(mapBounds.getNorth(), center.lat + latDelta),
    west: Math.min(mapBounds.getWest(), center.lng - lngDelta),
    east: Math.max(mapBounds.getEast(), center.lng + lngDelta)
  };
}

function searchCacheKey(area) {
  return `db-spots:v3:${area.south.toFixed(2)}:${area.north.toFixed(2)}:${area.west.toFixed(2)}:${area.east.toFixed(2)}`;
}

async function loadNearbySpots(center) {
  const sequence = ++searchSequence;
  searchCenter = center;
  const status = document.querySelector("#search-status");
  status.textContent = "Naturorte werden geladen …";
  const area = visibleSearchArea(center);
  const key = searchCacheKey(area);
  let discovered;
  const cached = sessionStorage.getItem(key);

  try {
    if (cached) {
      discovered = JSON.parse(cached);
    } else {
      const { data: stored, error: storedError } = await backend
        .from("spots")
        .select("id,name,type,icon,lat,lng,access,status,label,note,source_url,discovered")
        .gte("lat", area.south)
        .lte("lat", area.north)
        .gte("lng", area.west)
        .lte("lng", area.east)
        .limit(1000);
      if (storedError) throw storedError;
      discovered = (stored || []).map(spot => ({ ...spot, sourceUrl: spot.source_url }));

      sessionStorage.setItem(key, JSON.stringify(discovered));
    }
    if (sequence !== searchSequence) return;

    discovered = discovered
      .sort((a, b) => distanceKm(center, a) - distanceKm(center, b))
      .slice(0, 1000);
    const curatedNearby = curatedSpots.filter(spot =>
      spot.lat >= area.south && spot.lat <= area.north
      && spot.lng >= area.west && spot.lng <= area.east
    );
    const knownCoordinates = new Set(curatedNearby.map(spot => `${spot.lat.toFixed(3)}:${spot.lng.toFixed(3)}`));
    spots = [
      ...curatedNearby,
      ...discovered.filter(spot => !knownCoordinates.has(`${spot.lat.toFixed(3)}:${spot.lng.toFixed(3)}`))
    ];
    syncMarkers();
    render();
    status.textContent = spots.length
      ? `${discovered.length >= 1000 ? "Mindestens " : ""}${spots.length} Orte im sichtbaren Kartenausschnitt`
      : "Noch keine gespeicherten Orte in diesem Kartenausschnitt";
  } catch (error) {
    console.error("Nearby search failed", error);
    const curatedNearby = curatedSpots.filter(spot =>
      spot.lat >= area.south && spot.lat <= area.north
      && spot.lng >= area.west && spot.lng <= area.east
    );
    spots = curatedNearby;
    syncMarkers();
    render();
    status.textContent = `${spots.length} gespeicherte Orte – Hintergrundrecherche vorübergehend nicht erreichbar`;
  }
}

function scheduleNearbySearch() {
  clearTimeout(searchTimer);
  const center = map.getCenter();
  document.querySelector("#search-status").textContent = "Kartenausschnitt gewählt …";
  searchTimer = setTimeout(() => loadNearbySpots({ lat: center.lat, lng: center.lng }), 700);
}

function starRating(spotId, compact = false) {
  const rating = Number(state.ratings[spotId] || 0);
  const count = Number(state.ratingCounts[spotId] || 0);
  const label = rating ? `${rating} von 5 Sternen${count ? ` · ${count} Bewertung${count === 1 ? "" : "en"}` : ""}` : "Noch nicht bewertet";
  return `
    <div class="rating${compact ? " compact" : ""}" role="group" aria-label="Bewertung: ${label}" data-rating="${rating}">
      ${[1, 2, 3, 4, 5].map(value => `
        <button type="button" class="star${value <= rating ? " selected" : ""}" data-rate="${value}" data-spot="${spotId}"
          aria-label="${value} Stern${value === 1 ? "" : "e"}" title="${value} Stern${value === 1 ? "" : "e"}">★</button>
      `).join("")}
      <span class="rating-label">${label}</span>
    </div>`;
}

function card(spot) {
  const commentCount = (state.comments[spot.id] || []).length;
  return `
    <article class="spot">
      <div class="spot-top">
        <h3>${spot.icon} ${spot.name}</h3>
        <span class="status-dot ${spot.status}" title="${spot.label}" aria-label="${spot.label}"></span>
      </div>
      ${starRating(spot.id, true)}
      <div class="meta">${spot.access}</div>
      <p>${spot.note}</p>
      <div class="actions">
        <button class="open-detail" data-id="${spot.id}">Details & Kommentare${commentCount ? ` (${commentCount})` : ""}</button>
        <button class="show-map" data-id="${spot.id}">Auf Karte</button>
      </div>
    </article>`;
}

function render() {
  const visible = spots.filter(spot =>
    (activeFilter === "all" || spot.type === activeFilter)
    && (activePermissionFilter === "all" || spot.status === activePermissionFilter)
  );
  document.querySelector("#spots").innerHTML = visible.map(card).join("");
  document.querySelector("#count").textContent = `${visible.length} Orte`;

  spots.forEach(spot => {
    const marker = markers.get(spot.id);
    marker?.setPopupContent(popupMarkup(spot));
    const shouldShow = visible.includes(spot);
    if (shouldShow && !map.hasLayer(marker)) marker.addTo(map);
    if (!shouldShow && map.hasLayer(marker)) marker.removeFrom(map);
  });

  bindRatingButtons(document.querySelector("#spots"));
  document.querySelectorAll(".show-map").forEach(button => {
    button.addEventListener("click", () => {
      const spot = spots.find(item => item.id === button.dataset.id);
      map.setView([spot.lat, spot.lng], 14);
      markers.get(spot.id).openPopup();
      document.querySelector("#map").scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
  document.querySelectorAll(".open-detail").forEach(button => {
    button.addEventListener("click", () => openDetail(button.dataset.id));
  });
}

function bindRatingButtons(container) {
  container.querySelectorAll("[data-rate]").forEach(button => {
    button.addEventListener("click", async () => saveRating(button.dataset.spot, Number(button.dataset.rate)));
  });
}

async function saveRating(spotId, value) {
  if (!state.user) return alert("Die Datenbankverbindung wird noch hergestellt. Bitte versuche es gleich erneut.");
  const previous = state.ratings[spotId];
  state.ratings[spotId] = value;
  render();
  if (activeSpotId) renderDetail(activeSpotId);
  const { error } = await backend.from("ratings").upsert(
    { spot_id: spotId, user_id: state.user.id, value, updated_at: new Date().toISOString() },
    { onConflict: "spot_id,user_id" }
  );
  if (error) {
    state.ratings[spotId] = previous;
    render();
    if (activeSpotId) renderDetail(activeSpotId);
    alert("Die Bewertung konnte nicht gespeichert werden. Ist die Supabase-Einrichtung vollständig?");
  } else {
    await loadData();
  }
}

function commentMarkup(comment) {
  return `
    <article class="comment">
      <time datetime="${comment.created_at}">${dateFormatter.format(new Date(comment.created_at))}</time>
      <p>${escapeHtml(comment.body).replace(/\n/g, "<br>")}</p>
      ${comment.photos?.length ? `
        <div class="photo-grid">
          ${comment.photos.map(photo => `<a href="${photo.url}" target="_blank"><img src="${photo.url}" alt="Foto zum Kommentar" loading="lazy"></a>`).join("")}
        </div>` : ""}
    </article>`;
}

function renderDetail(spotId) {
  const spot = spots.find(item => item.id === spotId);
  if (!spot) return;
  const comments = state.comments[spot.id] || [];
  const destination = `${spot.lat},${spot.lng}`;
  detailContent.innerHTML = `
    <div class="detail-head">
      <button type="button" class="close-detail" aria-label="Detailansicht schließen">×</button>
      <p class="eyebrow">${spot.type} · ${spot.lat.toFixed(4)}, ${spot.lng.toFixed(4)}</p>
      <h2>${spot.icon} ${spot.name}</h2>
      <div class="detail-status"><span class="status-dot ${spot.status}"></span>${spot.label}</div>
    </div>
    <div class="detail-body">
      ${starRating(spot.id)}
      <p class="detail-note">${spot.note}</p>
      <dl class="facts">
        <div><dt>Zufahrt</dt><dd>${spot.access}</dd></div>
        <div><dt>Übernachtung</dt><dd>${spot.label}</dd></div>
      </dl>
      <a class="navigation-button" href="https://www.google.com/maps/dir/?api=1&destination=${destination}" target="_blank" rel="noopener">Navigation starten ↗</a>
      ${spot.sourceUrl ? `<a class="source-link" href="${spot.sourceUrl}" target="_blank" rel="noopener">Quelle: OpenStreetMap ↗</a>` : ""}

      <section class="comments-section">
        <div class="comments-title">
          <h3>Kommentare & Fotos</h3>
          <span>${comments.length}</span>
        </div>
        <form id="comment-form">
          <label for="comment-text">Dein Kommentar</label>
          <textarea id="comment-text" name="comment" rows="4" maxlength="1000" required placeholder="Wie war der Spot? Zufahrt, Ruhe, Aussicht …"></textarea>
          <label for="comment-photos" class="photo-picker">📷 Fotos hinzufügen <small>bis zu 4</small></label>
          <input id="comment-photos" name="photos" type="file" accept="image/*" multiple>
          <div id="photo-preview" class="photo-preview"></div>
          <button class="submit-comment" type="submit">Kommentar speichern</button>
          <p class="storage-note">${state.ready ? "Geräteübergreifend über Supabase gespeichert." : "Datenbankverbindung wird hergestellt …"}</p>
        </form>
        <div class="comments-list">
          ${comments.length ? comments.slice().reverse().map(commentMarkup).join("") : '<p class="empty">Noch keine Kommentare. Halte deine erste Erfahrung fest.</p>'}
        </div>
      </section>
    </div>`;

  detailContent.querySelector(".close-detail").addEventListener("click", closeDetail);
  bindRatingButtons(detailContent);
  const fileInput = detailContent.querySelector("#comment-photos");
  fileInput.addEventListener("change", () => previewFiles(fileInput.files));
  detailContent.querySelector("#comment-form").addEventListener("submit", saveComment);
}

function openDetail(spotId) {
  activeSpotId = spotId;
  renderDetail(spotId);
  if (!detailDialog.open) detailDialog.showModal();
  history.replaceState(null, "", `#spot/${spotId}`);
}

function closeDetail() {
  activeSpotId = null;
  detailDialog.close();
  history.replaceState(null, "", location.pathname + location.search);
}

function previewFiles(files) {
  const preview = detailContent.querySelector("#photo-preview");
  const selected = [...files].slice(0, 4);
  preview.innerHTML = selected.map(file => `<span>${escapeHtml(file.name)}</span>`).join("");
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const max = 1400;
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", .78));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function saveComment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector(".submit-comment");
  const text = form.elements.comment.value.trim();
  const files = [...form.elements.photos.files].slice(0, 4);
  if (!text) return;
  if (!state.user) return alert("Die Datenbankverbindung wird noch hergestellt. Bitte versuche es gleich erneut.");

  submit.disabled = true;
  submit.textContent = "Wird gespeichert …";
  try {
    const commentId = crypto.randomUUID();
    const { error: commentError } = await backend.from("comments").insert({
      id: commentId,
      spot_id: activeSpotId,
      user_id: state.user.id,
      body: text
    });
    if (commentError) throw commentError;

    for (const file of files) {
      const dataUrl = await resizeImage(file);
      const blob = await (await fetch(dataUrl)).blob();
      const path = `${state.user.id}/${commentId}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await backend.storage
        .from("spot-photos")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (uploadError) throw uploadError;
      const { error: photoError } = await backend.from("comment_photos").insert({
        comment_id: commentId,
        user_id: state.user.id,
        storage_path: path
      });
      if (photoError) throw photoError;
    }
    await loadData();
    renderDetail(activeSpotId);
  } catch (error) {
    console.error(error);
    alert("Der Beitrag konnte nicht vollständig gespeichert werden. Prüfe bitte die Supabase-Einrichtung.");
    submit.disabled = false;
    submit.textContent = "Kommentar speichern";
  }
}

async function loadData() {
  const [{ data: ratings, error: ratingsError }, { data: comments, error: commentsError }] = await Promise.all([
    backend.from("ratings").select("spot_id,user_id,value"),
    backend.from("comments").select("id,spot_id,body,created_at,comment_photos(storage_path)").order("created_at", { ascending: true })
  ]);
  if (ratingsError || commentsError) throw ratingsError || commentsError;

  state.ratings = {};
  state.ratingCounts = {};
  const totals = {};
  for (const rating of ratings) {
    totals[rating.spot_id] = (totals[rating.spot_id] || 0) + rating.value;
    state.ratingCounts[rating.spot_id] = (state.ratingCounts[rating.spot_id] || 0) + 1;
    if (rating.user_id === state.user?.id) state.ratings[rating.spot_id] = rating.value;
  }
  for (const spotId of Object.keys(totals)) {
    if (!state.ratings[spotId]) state.ratings[spotId] = Math.round(totals[spotId] / state.ratingCounts[spotId]);
  }

  state.comments = {};
  for (const comment of comments) {
    comment.photos = (comment.comment_photos || []).map(photo => ({
      url: backend.storage.from("spot-photos").getPublicUrl(photo.storage_path).data.publicUrl
    }));
    (state.comments[comment.spot_id] ||= []).push(comment);
  }
  state.ready = true;
  render();
  if (activeSpotId) renderDetail(activeSpotId);
}

async function initializeBackend() {
  try {
    const { data: sessionData } = await backend.auth.getSession();
    if (sessionData.session) {
      state.user = sessionData.session.user;
    } else {
      const { data, error } = await backend.auth.signInAnonymously();
      if (error) throw error;
      state.user = data.user;
    }
    await loadData();
  } catch (error) {
    console.error("Supabase initialization failed", error);
    document.querySelector(".notice").insertAdjacentHTML(
      "beforeend",
      '<span class="backend-warning"> Die Community-Funktionen warten noch auf die einmalige Datenbankeinrichtung.</span>'
    );
  }
}

spots.forEach(addMarker);
render();
loadNearbySpots(searchCenter);

map.on("moveend", scheduleNearbySearch);
document.addEventListener("click", event => {
  const detailButton = event.target.closest("[data-popup-detail]");
  if (detailButton) {
    map.closePopup();
    openDetail(detailButton.dataset.popupDetail);
    return;
  }
  const commentsButton = event.target.closest("[data-popup-comments]");
  if (commentsButton) {
    map.closePopup();
    openDetail(commentsButton.dataset.popupComments);
    setTimeout(() => {
      detailContent.querySelector(".comments-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }
});
map.on("click", event => {
  if (selectedLocationPin) {
    selectedLocationPin.setLatLng(event.latlng);
  } else {
    selectedLocationPin = L.circleMarker(event.latlng, {
      radius: 7,
      color: "#fff",
      weight: 3,
      fillColor: "#17372f",
      fillOpacity: 1
    }).bindTooltip("Gewählter Standort").addTo(map);
  }
  map.panTo(event.latlng);
  loadNearbySpots({ lat: event.latlng.lat, lng: event.latlng.lng });
});
document.querySelector("#search-radius").addEventListener("change", event => {
  searchRadius = Number(event.target.value);
  loadNearbySpots({ lat: map.getCenter().lat, lng: map.getCenter().lng });
});

document.querySelectorAll(".type-filter").forEach(button => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll(".type-filter").forEach(item => item.classList.toggle("active", item === button));
    render();
  });
});

document.querySelectorAll(".permission-filter").forEach(button => {
  button.addEventListener("click", () => {
    activePermissionFilter = button.dataset.permission;
    document.querySelectorAll(".permission-filter").forEach(item => item.classList.toggle("active", item === button));
    render();
  });
});

detailDialog.addEventListener("click", event => {
  if (event.target === detailDialog) closeDetail();
});
detailDialog.addEventListener("cancel", event => {
  event.preventDefault();
  closeDetail();
});

document.querySelector("#locate").addEventListener("click", () => {
  if (!navigator.geolocation) return alert("Standortbestimmung wird von diesem Browser nicht unterstützt.");
  navigator.geolocation.getCurrentPosition(
    position => {
      const point = [position.coords.latitude, position.coords.longitude];
      L.circleMarker(point, { radius: 8, color: "#fff", weight: 3, fillColor: "#2474b5", fillOpacity: 1 })
        .bindPopup("Dein Standort").addTo(map).openPopup();
      map.setView(point, 13);
      loadNearbySpots({ lat: point[0], lng: point[1] });
    },
    () => alert("Der Standort konnte nicht ermittelt werden. Bitte erlaube den Zugriff in deinem Browser."),
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

const initialSpot = location.hash.match(/^#spot\/([a-z0-9-]+)$/)?.[1];
if (initialSpot && spots.some(spot => spot.id === initialSpot)) openDetail(initialSpot);
initializeBackend();
