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
const clusterMarkers = [];
const DETAIL_RADIUS_KM = 25;
const CLUSTER_RADIUS_KM = 25;
const commonsPhotoCache = new Map();
const detailDialog = document.querySelector("#spot-detail");
const detailContent = document.querySelector("#detail-content");
const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });
let activeFilter = "all";
let activePermissionFilter = "all";
let searchQuery = "";
let activeSpotId = null;
let searchRadius = document.querySelector("#search-radius").value;
let searchTimer = null;
let searchSequence = 0;
let searchCenter = { lat: 54.325, lng: 10.56 };
let selectedLocationPin = null;
let activeSuggestionIndex = -1;
let searchRenderFrame = 0;
let placeSearchTimer = 0;
let placeSearchController = null;
let placeSuggestionQuery = "";
let placeSuggestions = [];
let visibleSpotLimit = 10;
let communityTimer = 0;
let communitySequence = 0;

const backend = window.ROOF_TENT_BACKEND.client;
const state = { ratings: {}, ratingCounts: {}, comments: {}, user: null, ready: false };
const searchInput = document.querySelector("#spot-search");
const searchSuggestions = document.querySelector("#search-suggestions");
const spotList = document.querySelector("#spots");
const loadMoreSpotsButton = document.querySelector("#load-more-spots");

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function safeExternalUrl(value, allowedHosts) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && allowedHosts.some(host =>
      url.hostname === host || url.hostname.endsWith(`.${host}`)
    ) ? url.href : "";
  } catch {
    return "";
  }
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("de")
    .trim();
}

function searchScore(spot, query) {
  if (!query) return 0;
  const name = normalizeSearch(spot.name);
  const words = name.split(/\s+/);
  if (name === query) return 100;
  if (name.startsWith(query)) return 90;
  if (words.some(word => word.startsWith(query))) return 80;
  if (name.includes(query)) return 70;

  const details = normalizeSearch([spot.note, spot.access, spot.label, spot.type].join(" "));
  if (details.includes(query)) return 45;

  let queryIndex = 0;
  for (const character of name) {
    if (character === query[queryIndex]) queryIndex += 1;
    if (queryIndex === query.length) return 30;
  }
  return -1;
}

function matchingSpots(query = searchQuery) {
  const normalizedQuery = normalizeSearch(query);
  return spots
    .map(spot => ({ spot, score: searchScore(spot, normalizedQuery) }))
    .filter(result => !normalizedQuery || result.score >= 0)
    .sort((a, b) => b.score - a.score || a.spot.name.localeCompare(b.spot.name, "de"))
    .map(result => result.spot);
}

function closeSuggestions() {
  activeSuggestionIndex = -1;
  searchSuggestions.hidden = true;
  searchSuggestions.innerHTML = "";
  searchInput.setAttribute("aria-expanded", "false");
  searchInput.removeAttribute("aria-activedescendant");
}

function renderSuggestions() {
  const query = normalizeSearch(searchInput.value);
  if (query.length < 1) return closeSuggestions();
  const spotSuggestions = matchingSpots(query).slice(0, 4);
  const remoteSuggestions = placeSuggestionQuery === query ? placeSuggestions.slice(0, 5) : [];
  const suggestionCount = spotSuggestions.length + remoteSuggestions.length;
  if (!suggestionCount) return closeSuggestions();

  activeSuggestionIndex = Math.min(activeSuggestionIndex, suggestionCount - 1);
  searchSuggestions.innerHTML = spotSuggestions.map((spot, index) => `
    <button id="search-option-${index}" class="search-suggestion${index === activeSuggestionIndex ? " active" : ""}"
      type="button" role="option" aria-selected="${index === activeSuggestionIndex}" data-suggestion="${escapeHtml(spot.id)}">
      <i>${escapeHtml(spot.icon)}</i>
      <strong>${escapeHtml(spot.name)}</strong>
      <small>Gespeicherter Spot · ${spot.type === "meer" ? "Meer" : spot.type === "see" ? "See" : "Natur"}</small>
    </button>`).join("");
  searchSuggestions.insertAdjacentHTML("beforeend", remoteSuggestions.map((place, offset) => {
    const index = spotSuggestions.length + offset;
    return `
      <button id="search-option-${index}" class="search-suggestion${index === activeSuggestionIndex ? " active" : ""}"
        type="button" role="option" aria-selected="${index === activeSuggestionIndex}"
        data-place-lat="${place.lat}" data-place-lng="${place.lng}" data-place-name="${escapeHtml(place.name)}">
        <i>⌖</i>
        <strong>${escapeHtml(place.name)}</strong>
        <small>${escapeHtml(place.context)}</small>
      </button>`;
  }).join(""));
  searchSuggestions.hidden = false;
  searchInput.setAttribute("aria-expanded", "true");
  if (activeSuggestionIndex >= 0) {
    searchInput.setAttribute("aria-activedescendant", `search-option-${activeSuggestionIndex}`);
  } else {
    searchInput.removeAttribute("aria-activedescendant");
  }
}

function placeContext(properties) {
  return [...new Set([
    properties.city,
    properties.county,
    properties.state,
    properties.country
  ].filter(Boolean))].join(" · ") || "Ort in Europa";
}

async function loadPlaceSuggestions(query) {
  const normalizedQuery = normalizeSearch(query);
  if (normalizedQuery.length < 2) {
    placeSuggestions = [];
    placeSuggestionQuery = "";
    renderSuggestions();
    return;
  }

  placeSearchController?.abort();
  placeSearchController = new AbortController();
  const params = new URLSearchParams({
    q: query.trim(),
    limit: "5",
    lang: "de",
    bbox: "-25,34,50,72"
  });

  try {
    const response = await fetch(`https://photon.komoot.io/api/?${params}`, {
      signal: placeSearchController.signal,
      referrerPolicy: "strict-origin-when-cross-origin"
    });
    if (!response.ok) throw new Error(`Place search returned ${response.status}`);
    const result = await response.json();
    if (normalizeSearch(searchInput.value) !== normalizedQuery) return;
    placeSuggestionQuery = normalizedQuery;
    placeSuggestions = (result.features || []).flatMap(feature => {
      const [lng, lat] = feature.geometry?.coordinates || [];
      const properties = feature.properties || {};
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !properties.name) return [];
      return [{
        name: String(properties.name),
        context: placeContext(properties),
        lat,
        lng
      }];
    });
    renderSuggestions();
  } catch (error) {
    if (error.name === "AbortError") return;
    console.warn("Place autocomplete unavailable", error);
    placeSuggestions = [];
    placeSuggestionQuery = normalizedQuery;
    renderSuggestions();
  }
}

function selectPlace(name, lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  searchInput.value = name;
  searchQuery = "";
  closeSuggestions();
  if (selectedLocationPin) {
    selectedLocationPin.setLatLng([lat, lng]);
  } else {
    selectedLocationPin = L.circleMarker([lat, lng], {
      radius: 7,
      color: "#fff",
      weight: 3,
      fillColor: "#17372f",
      fillOpacity: 1
    }).bindTooltip(name).addTo(map);
  }
  map.setView([lat, lng], 10);
  loadNearbySpots({ lat, lng });
  document.querySelector("#map").scrollIntoView({ behavior: "smooth", block: "center" });
}

function selectSuggestion(spotId) {
  const spot = spots.find(item => item.id === spotId);
  if (!spot) return;
  searchInput.value = spot.name;
  searchQuery = "";
  searchCenter = { lat: spot.lat, lng: spot.lng };
  visibleSpotLimit = 10;
  closeSuggestions();
  map.setView([spot.lat, spot.lng], 14);
  loadNearbySpots(searchCenter).then(() => markers.get(spot.id)?.openPopup());
  document.querySelector("#map").scrollIntoView({ behavior: "smooth", block: "center" });
}

function markerIcon(spot) {
  return L.divIcon({
    className: "",
    html: `<span class="spot-marker" style="background:${colors[spot.status] || colors.amber}">${escapeHtml(spot.icon)}</span>`,
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
  const spotId = escapeHtml(spot.id);
  return `
    <div class="map-popup">
      <div class="map-popup-title">
        <strong>${escapeHtml(spot.icon)} ${escapeHtml(spot.name)}</strong>
        <i class="status-dot ${spot.status}" title="${escapeHtml(spot.label)}"></i>
      </div>
      <small>${escapeHtml(spot.access)}</small>
      ${popupRating(spot.id)}
      <div class="map-popup-actions">
        <button type="button" data-popup-detail="${spotId}">Details</button>
        <button type="button" data-popup-comments="${spotId}">Kommentare</button>
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

function clusterIcon(count, radiusKm) {
  const size = count >= 100 ? 48 : count >= 10 ? 42 : 36;
  return L.divIcon({
    className: "",
    html: `<span class="spot-cluster" aria-label="${count} Spots im Umkreis von ${radiusKm} km"><strong>${count}</strong><small>${radiusKm} km</small></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

function clusterRadiusForZoom() {
  if (map.getZoom() >= 13) return 0;
  if (map.getZoom() === 12) return 5;
  return CLUSTER_RADIUS_KM;
}

function clusterSpots(visibleSpots) {
  const radiusKm = clusterRadiusForZoom();
  if (!radiusKm) {
    return visibleSpots.map(spot => ({ center: { lat: spot.lat, lng: spot.lng }, spots: [spot], radiusKm: 0 }));
  }
  const clusters = [];
  const buckets = new Map();
  const cellDegrees = radiusKm / 111;
  const bucketKey = (latCell, lngCell) => `${latCell}:${lngCell}`;

  for (const spot of visibleSpots) {
    const latCell = Math.floor(spot.lat / cellDegrees);
    const lngCell = Math.floor(spot.lng / cellDegrees);
    const candidates = [];
    for (let latOffset = -1; latOffset <= 1; latOffset += 1) {
      for (let lngOffset = -4; lngOffset <= 4; lngOffset += 1) {
        candidates.push(...(buckets.get(bucketKey(latCell + latOffset, lngCell + lngOffset)) || []));
      }
    }
    let cluster = candidates.find(item => distanceKm(item.center, spot) <= radiusKm);
    if (!cluster) {
      cluster = { center: { lat: spot.lat, lng: spot.lng }, spots: [], radiusKm };
      clusters.push(cluster);
      const key = bucketKey(latCell, lngCell);
      buckets.set(key, [...(buckets.get(key) || []), cluster]);
    }
    cluster.spots.push(spot);
  }
  return clusters;
}

function syncContextMarkers(detailSpots, clusters) {
  const individualSpots = clusters.filter(cluster => cluster.spots.length === 1).map(cluster => cluster.spots[0]);
  const groupedClusters = clusters.filter(cluster => cluster.spots.length > 1);
  const currentIds = new Set(individualSpots.map(spot => spot.id));
  for (const [id, marker] of markers) {
    if (!currentIds.has(id)) {
      marker.remove();
      markers.delete(id);
    }
  }
  individualSpots.forEach(spot => {
    if (!markers.has(spot.id)) {
      addMarker(spot);
    } else {
      markers.get(spot.id)?.setPopupContent(popupMarkup(spot));
    }
  });

  clusterMarkers.splice(0).forEach(marker => marker.remove());
  groupedClusters.forEach(cluster => {
    const marker = L.marker([cluster.center.lat, cluster.center.lng], {
      icon: clusterIcon(cluster.spots.length, cluster.radiusKm),
      keyboard: true,
      bubblingMouseEvents: false,
      title: `${cluster.spots.length} Spots im Umkreis von ${cluster.radiusKm} km`
    }).addTo(map);
    marker.bindTooltip(`${cluster.spots.length} Spots · für Details öffnen`, { direction: "top" });
    marker.on("click", () => {
      searchCenter = { ...cluster.center };
      if (selectedLocationPin) {
        selectedLocationPin.setLatLng([cluster.center.lat, cluster.center.lng]);
      }
      map.setView([cluster.center.lat, cluster.center.lng], Math.min(14, Math.max(map.getZoom() + 2, 12)));
      loadNearbySpots(searchCenter);
    });
    clusterMarkers.push(marker);
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
  if (searchRadius === "europe") {
    return { south: 34, north: 72, west: -25, east: 50 };
  }
  const mapBounds = map.getBounds();
  const radius = Number(searchRadius);
  const latDelta = radius / 111000;
  const lngDelta = radius / (111000 * Math.max(.2, Math.cos(center.lat * Math.PI / 180)));
  return {
    south: Math.min(mapBounds.getSouth(), center.lat - latDelta),
    north: Math.max(mapBounds.getNorth(), center.lat + latDelta),
    west: Math.min(mapBounds.getWest(), center.lng - lngDelta),
    east: Math.max(mapBounds.getEast(), center.lng + lngDelta)
  };
}

function searchCacheKey(area) {
  return `db-spots:v6:${area.south.toFixed(2)}:${area.north.toFixed(2)}:${area.west.toFixed(2)}:${area.east.toFixed(2)}`;
}

function isLargeSearchArea(area) {
  return searchRadius === "europe"
    || area.north - area.south > 5
    || area.east - area.west > 8;
}

async function fetchStoredSpots(area) {
  const pageSize = 1000;
  const maxResults = isLargeSearchArea(area) ? 5000 : 2000;
  const stored = [];

  for (let from = 0; from < maxResults; from += pageSize) {
    const { data, error } = await backend
      .from("spots")
      .select("id,name,type,icon,lat,lng,access,status,label,note,source_url,discovered")
      .gte("lat", area.south)
      .lte("lat", area.north)
      .gte("lng", area.west)
      .lte("lng", area.east)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    stored.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return stored;
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
      const stored = await fetchStoredSpots(area);
      discovered = stored.map(spot => ({ ...spot, sourceUrl: spot.source_url }));

      if (!isLargeSearchArea(area)) {
        sessionStorage.setItem(key, JSON.stringify(discovered));
      }
    }
    if (sequence !== searchSequence) return;

    discovered = discovered
      .sort((a, b) => distanceKm(center, a) - distanceKm(center, b))
      .slice(0, isLargeSearchArea(area) ? 5000 : 2000);
    const curatedNearby = curatedSpots.filter(spot =>
      spot.lat >= area.south && spot.lat <= area.north
      && spot.lng >= area.west && spot.lng <= area.east
    );
    const knownCoordinates = new Set(curatedNearby.map(spot => `${spot.lat.toFixed(3)}:${spot.lng.toFixed(3)}`));
    spots = [
      ...curatedNearby,
      ...discovered.filter(spot => !knownCoordinates.has(`${spot.lat.toFixed(3)}:${spot.lng.toFixed(3)}`))
    ].sort((a, b) => distanceKm(center, a) - distanceKm(center, b));
    visibleSpotLimit = 10;
    const context = render();
    scheduleCommunityLoad();
    status.textContent = spots.length
      ? `${context.detailCount} Detailspots im 25-km-Umkreis · ${context.clusterCount} Cluster im Kartenausschnitt${discovered.length >= (isLargeSearchArea(area) ? 5000 : 2000) ? " · mindestens 5.000 Treffer geladen" : ""}`
      : "Noch keine gespeicherten Orte in diesem Kartenausschnitt";
  } catch (error) {
    console.error("Nearby search failed", error);
    const curatedNearby = curatedSpots.filter(spot =>
      spot.lat >= area.south && spot.lat <= area.north
      && spot.lng >= area.west && spot.lng <= area.east
    );
    spots = curatedNearby.sort((a, b) => distanceKm(center, a) - distanceKm(center, b));
    visibleSpotLimit = 10;
    render();
    scheduleCommunityLoad();
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
  const safeSpotId = escapeHtml(spotId);
  return `
    <div class="rating${compact ? " compact" : ""}" role="group" aria-label="Bewertung: ${escapeHtml(label)}" data-rating="${rating}">
      ${[1, 2, 3, 4, 5].map(value => `
        <button type="button" class="star${value <= rating ? " selected" : ""}" data-rate="${value}" data-spot="${safeSpotId}"
          aria-label="${value} Stern${value === 1 ? "" : "e"}" title="${value} Stern${value === 1 ? "" : "e"}">★</button>
      `).join("")}
      <span class="rating-label">${escapeHtml(label)}</span>
    </div>`;
}

function plainText(value) {
  const template = document.createElement("template");
  template.innerHTML = String(value || "");
  return (template.content.textContent || "").replace(/\s+/g, " ").trim();
}

async function fetchCommonsPhotos(spot, limit = 3) {
  if (commonsPhotoCache.has(spot.id)) return commonsPhotoCache.get(spot.id).slice(0, limit);
  const cacheKey = `commons-media:v1:${spot.id}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    const photos = JSON.parse(cached);
    commonsPhotoCache.set(spot.id, photos);
    return photos.slice(0, limit);
  }

  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "geosearch",
    ggsprimary: "all",
    ggsnamespace: "6",
    ggslimit: "8",
    ggsradius: "10000",
    ggscoord: `${spot.lat}|${spot.lng}`,
    prop: "imageinfo",
    iiprop: "url|mime|extmetadata",
    iiurlwidth: "1200"
  });
  try {
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      headers: { Accept: "application/json" },
      referrerPolicy: "strict-origin-when-cross-origin"
    });
    if (!response.ok) throw new Error(`Commons ${response.status}`);
    const payload = await response.json();
    const photos = Object.values(payload.query?.pages || {})
      .sort((a, b) => (a.index || 0) - (b.index || 0))
      .map(page => {
        const info = page.imageinfo?.[0];
        const url = safeExternalUrl(info?.thumburl || info?.url, ["upload.wikimedia.org"]);
        const sourceUrl = safeExternalUrl(info?.descriptionurl, ["commons.wikimedia.org"]);
        const mime = String(info?.mime || "");
        if (!url || !sourceUrl || !mime.startsWith("image/") || mime.includes("svg")) return null;
        const metadata = info.extmetadata || {};
        return {
          url,
          sourceUrl,
          alt: `Umgebungsfoto nahe ${spot.name}`,
          credit: plainText(metadata.Artist?.value || metadata.Credit?.value || "Wikimedia Commons"),
          license: plainText(metadata.LicenseShortName?.value || "Lizenz auf Commons")
        };
      })
      .filter(Boolean)
      .slice(0, 3);
    commonsPhotoCache.set(spot.id, photos);
    try { sessionStorage.setItem(cacheKey, JSON.stringify(photos)); } catch { /* Cache ist optional. */ }
    return photos.slice(0, limit);
  } catch (error) {
    console.info("Kein Commons-Umgebungsfoto verfügbar", error);
    commonsPhotoCache.set(spot.id, []);
    return [];
  }
}

function communityPhotosForSpot(spotId) {
  return (state.comments[spotId] || []).flatMap(comment => comment.photos || [])
    .map(photo => safeExternalUrl(photo.url, ["supabase.co"]))
    .filter(Boolean)
    .map(url => ({ url, sourceUrl: url, alt: "Community-Foto zu diesem Spot", credit: "Community", license: "Vom Nutzer bereitgestellt" }));
}

function createMediaFigure(photo, compact = false) {
  const figure = document.createElement("figure");
  figure.className = compact ? "spot-media is-loaded" : "gallery-item";
  const image = document.createElement("img");
  image.src = photo.url;
  image.alt = photo.alt;
  image.loading = "lazy";
  image.decoding = "async";
  figure.append(image);
  if (!compact) {
    const caption = document.createElement("figcaption");
    const link = document.createElement("a");
    link.href = photo.sourceUrl;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = `${photo.credit} · ${photo.license} ↗`;
    caption.append(link);
    figure.append(caption);
  }
  return figure;
}

async function hydrateVisibleMedia(visibleSpots) {
  await Promise.all(visibleSpots.map(async spot => {
    const target = [...spotList.querySelectorAll("[data-spot-photo]")]
      .find(node => node.dataset.spotPhoto === spot.id);
    if (!target) return;
    const photo = communityPhotosForSpot(spot.id)[0] || (await fetchCommonsPhotos(spot, 1))[0];
    if (!photo || !target.isConnected) {
      target.classList.add("is-empty");
      return;
    }
    target.replaceWith(createMediaFigure(photo, true));
  }));
}

function card(spot) {
  const commentCount = (state.comments[spot.id] || []).length;
  const spotId = escapeHtml(spot.id);
  return `
    <article class="spot">
      <figure class="spot-media is-loading" data-spot-photo="${spotId}" aria-label="Umgebungsfoto wird geladen">
        <span>${escapeHtml(spot.icon)}</span>
      </figure>
      <div class="spot-top">
        <h3>${escapeHtml(spot.icon)} ${escapeHtml(spot.name)}</h3>
        <span class="status-dot ${spot.status}" title="${escapeHtml(spot.label)}" aria-label="${escapeHtml(spot.label)}"></span>
      </div>
      ${starRating(spot.id, true)}
      <div class="meta">${escapeHtml(spot.access)}</div>
      <p>${escapeHtml(spot.note)}</p>
      <div class="actions">
        <button class="open-detail" data-id="${spotId}">Details & Kommentare${commentCount ? ` (${commentCount})` : ""}</button>
        <button class="show-map" data-id="${spotId}">Auf Karte</button>
      </div>
    </article>`;
}

function render() {
  const normalizedQuery = normalizeSearch(searchQuery);
  const matchedIds = normalizedQuery ? new Set(matchingSpots().map(spot => spot.id)) : null;
  const filtered = spots.filter(spot =>
    (activeFilter === "all" || spot.type === activeFilter)
    && (activePermissionFilter === "all" || spot.status === activePermissionFilter)
    && (!matchedIds || matchedIds.has(spot.id))
  );
  const detailSpots = filtered.filter(spot => distanceKm(searchCenter, spot) <= DETAIL_RADIUS_KM);
  const listed = detailSpots.slice(0, visibleSpotLimit);
  spotList.innerHTML = listed.length
    ? listed.map(card).join("")
    : '<div class="empty-state"><strong>Keine Detailspots im 25-km-Umkreis</strong><span>Öffne einen Kartencluster oder wähle einen anderen Standort.</span></div>';
  document.querySelector("#count").textContent = `${detailSpots.length} Spots innerhalb 25 km`;
  loadMoreSpotsButton.hidden = listed.length >= detailSpots.length;
  loadMoreSpotsButton.textContent = `Weitere ${Math.min(10, detailSpots.length - listed.length)} Spots anzeigen`;
  const clusters = clusterSpots(filtered);
  syncContextMarkers(detailSpots, clusters);
  hydrateVisibleMedia(listed);
  return { detailCount: detailSpots.length, clusterCount: clusters.filter(cluster => cluster.spots.length > 1).length };
}

loadMoreSpotsButton.addEventListener("click", () => {
  visibleSpotLimit += 10;
  render();
});

spotList.addEventListener("click", event => {
  const ratingButton = event.target.closest("[data-rate]");
  if (ratingButton) {
    saveRating(ratingButton.dataset.spot, Number(ratingButton.dataset.rate));
    return;
  }
  const mapButton = event.target.closest(".show-map");
  if (mapButton) {
    const spot = spots.find(item => item.id === mapButton.dataset.id);
    if (!spot) return;
    map.setView([spot.lat, spot.lng], 14);
    markers.get(spot.id)?.openPopup();
    document.querySelector("#map").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const detailButton = event.target.closest(".open-detail");
  if (detailButton) openDetail(detailButton.dataset.id);
});

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
  const createdAt = new Date(comment.created_at);
  return `
    <article class="comment">
      <time datetime="${escapeHtml(comment.created_at)}">${Number.isNaN(createdAt.valueOf()) ? "" : dateFormatter.format(createdAt)}</time>
      <p>${escapeHtml(comment.body).replace(/\n/g, "<br>")}</p>
      ${comment.photos?.length ? `
        <div class="photo-grid">
          ${comment.photos.map(photo => safeExternalUrl(photo.url, ["supabase.co"])).filter(Boolean)
            .map(url => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener"><img src="${escapeHtml(url)}" alt="Foto zum Kommentar" loading="lazy"></a>`).join("")}
        </div>` : ""}
    </article>`;
}

function renderDetail(spotId) {
  const spot = spots.find(item => item.id === spotId);
  if (!spot) return;
  const comments = state.comments[spot.id] || [];
  const destination = `${spot.lat},${spot.lng}`;
  const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodeURIComponent(destination)}`;
  const sourceUrl = safeExternalUrl(spot.sourceUrl, ["openstreetmap.org"]);
  detailContent.innerHTML = `
    <div class="detail-head">
      <button type="button" class="close-detail" aria-label="Detailansicht schließen">×</button>
      <p class="eyebrow">${escapeHtml(spot.type)} · ${spot.lat.toFixed(4)}, ${spot.lng.toFixed(4)}</p>
      <h2>${escapeHtml(spot.icon)} ${escapeHtml(spot.name)}</h2>
      <div class="detail-status"><span class="status-dot ${spot.status}"></span>${escapeHtml(spot.label)}</div>
    </div>
    <div class="detail-body">
      <section class="spot-gallery" data-detail-gallery="${escapeHtml(spot.id)}" aria-label="Bilder zum Spot">
        <div class="gallery-loading">Bilder aus der Umgebung werden geladen …</div>
      </section>
      ${starRating(spot.id)}
      <p class="detail-note">${escapeHtml(spot.note)}</p>
      <dl class="facts">
        <div><dt>Zufahrt</dt><dd>${escapeHtml(spot.access)}</dd></div>
        <div><dt>Übernachtung</dt><dd>${escapeHtml(spot.label)}</dd></div>
      </dl>
      <a class="navigation-button" href="https://www.google.com/maps/dir/?api=1&destination=${destination}" target="_blank" rel="noopener">Navigation starten ↗</a>
      <a class="streetview-button" href="${streetViewUrl}" target="_blank" rel="noopener">Street View prüfen ↗</a>
      ${sourceUrl ? `<a class="source-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener">Quelle: OpenStreetMap ↗</a>` : ""}

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
  hydrateDetailGallery(spot);
  bindRatingButtons(detailContent);
  const fileInput = detailContent.querySelector("#comment-photos");
  fileInput.addEventListener("change", () => previewFiles(fileInput.files));
  detailContent.querySelector("#comment-form").addEventListener("submit", saveComment);
}

async function hydrateDetailGallery(spot) {
  const target = detailContent.querySelector("[data-detail-gallery]");
  if (!target) return;
  const communityPhotos = communityPhotosForSpot(spot.id);
  const commonsPhotos = await fetchCommonsPhotos(spot, Math.max(0, 3 - communityPhotos.length));
  if (activeSpotId !== spot.id || !target.isConnected) return;
  const photos = [...communityPhotos, ...commonsPhotos].slice(0, 6);
  target.innerHTML = "";
  if (!photos.length) {
    target.innerHTML = '<p class="gallery-empty">Noch kein frei verfügbares Umgebungsfoto. Du kannst unten das erste Spotfoto ergänzen.</p>';
    return;
  }
  photos.forEach(photo => target.append(createMediaFigure(photo)));
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
    if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) {
      reject(new Error("Unsupported image upload"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        if (image.width * image.height > 60_000_000) {
          reject(new Error("Image dimensions are too large"));
          return;
        }
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
  if (!state.user) return;
  const sequence = ++communitySequence;
  // Community data is only needed for detail spots in the current context.
  // Avoid dozens of requests when the map is showing a Europe-wide overview.
  const contextualSpots = spots.filter(
    spot => distanceKm(searchCenter, spot) <= DETAIL_RADIUS_KM
  );
  const spotIds = [...new Set([
    ...contextualSpots.map(spot => spot.id),
    ...(activeSpotId ? [activeSpotId] : [])
  ])];
  const chunks = [];
  for (let index = 0; index < spotIds.length; index += 150) {
    chunks.push(spotIds.slice(index, index + 150));
  }
  if (!chunks.length) return;

  const [ratingResponses, commentResponses] = await Promise.all([
    Promise.all(chunks.map(ids => backend
      .from("ratings")
      .select("spot_id,user_id,value")
      .in("spot_id", ids)
      .limit(5000))),
    Promise.all(chunks.map(ids => backend
      .from("comments")
      .select("id,spot_id,body,created_at,comment_photos(storage_path)")
      .in("spot_id", ids)
      .order("created_at", { ascending: true })
      .limit(2000)))
  ]);
  const failed = [...ratingResponses, ...commentResponses].find(response => response.error);
  if (failed) throw failed.error;
  if (sequence !== communitySequence) return;
  const ratings = ratingResponses.flatMap(response => response.data || []);
  const comments = commentResponses.flatMap(response => response.data || []);

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

function scheduleCommunityLoad() {
  if (!state.user) return;
  clearTimeout(communityTimer);
  communityTimer = setTimeout(() => {
    loadData().catch(error => console.error("Community data refresh failed", error));
  }, 250);
}

async function initializeBackend() {
  try {
    const session = await window.ROOF_TENT_BACKEND.ensureAnonymousSession();
    state.user = session.user;
    await loadData();
  } catch (error) {
    console.error("Supabase initialization failed", error);
    document.querySelector(".notice").insertAdjacentHTML(
      "beforeend",
      '<span class="backend-warning"> Die Community-Funktionen warten noch auf die einmalige Datenbankeinrichtung.</span>'
    );
  }
}

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
  searchRadius = event.target.value;
  if (searchRadius === "europe") {
    map.fitBounds([[34, -25], [72, 50]], { padding: [12, 12] });
  }
  loadNearbySpots({ lat: map.getCenter().lat, lng: map.getCenter().lng });
});

searchInput.addEventListener("input", event => {
  searchQuery = event.target.value;
  visibleSpotLimit = 10;
  placeSuggestions = [];
  placeSuggestionQuery = "";
  clearTimeout(placeSearchTimer);
  placeSearchTimer = setTimeout(() => loadPlaceSuggestions(event.target.value), 320);
  cancelAnimationFrame(searchRenderFrame);
  searchRenderFrame = requestAnimationFrame(() => {
    render();
    renderSuggestions();
  });
});

searchInput.addEventListener("keydown", event => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    if (searchSuggestions.hidden) renderSuggestions();
    const options = [...searchSuggestions.querySelectorAll("[data-suggestion], [data-place-lat]")];
    const direction = event.key === "ArrowDown" ? 1 : -1;
    activeSuggestionIndex = Math.max(0, Math.min(options.length - 1, activeSuggestionIndex + direction));
    renderSuggestions();
  } else if (event.key === "Enter" && activeSuggestionIndex >= 0) {
    event.preventDefault();
    const options = [...searchSuggestions.querySelectorAll("[data-suggestion], [data-place-lat]")];
    options[activeSuggestionIndex]?.click();
  } else if (event.key === "Escape") {
    closeSuggestions();
  }
});

searchSuggestions.addEventListener("mousedown", event => {
  const spotOption = event.target.closest("[data-suggestion]");
  const placeOption = event.target.closest("[data-place-lat]");
  if (spotOption) {
    event.preventDefault();
    selectSuggestion(spotOption.dataset.suggestion);
  } else if (placeOption) {
    event.preventDefault();
    selectPlace(
      placeOption.dataset.placeName,
      Number(placeOption.dataset.placeLat),
      Number(placeOption.dataset.placeLng)
    );
  }
});

searchInput.addEventListener("blur", () => setTimeout(closeSuggestions, 120));
searchInput.addEventListener("focus", renderSuggestions);

document.querySelectorAll(".type-filter").forEach(button => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    visibleSpotLimit = 10;
    document.querySelectorAll(".type-filter").forEach(item => item.classList.toggle("active", item === button));
    render();
  });
});

document.querySelectorAll(".permission-filter").forEach(button => {
  button.addEventListener("click", () => {
    activePermissionFilter = button.dataset.permission;
    visibleSpotLimit = 10;
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
