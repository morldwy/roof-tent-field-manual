const spots = [
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

const colors = { green: "#2e7d55", amber: "#d58a21", red: "#b64b3b" };
const map = L.map("map", { zoomControl: false }).setView([54.325, 10.56], 11);
L.control.zoom({ position: "bottomright" }).addTo(map);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const markers = new Map();
let activeFilter = "all";

function markerIcon(spot) {
  return L.divIcon({
    className: "",
    html: `<span class="spot-marker" style="background:${colors[spot.status]}">${spot.icon}</span>`,
    iconSize: [32, 32], iconAnchor: [16, 16]
  });
}

function addMarker(spot) {
  const marker = L.marker([spot.lat, spot.lng], { icon: markerIcon(spot) })
    .bindPopup(`<strong>${spot.name}</strong><br>${spot.label}<br><small>${spot.access}</small>`)
    .addTo(map);
  markers.set(spot.id, marker);
}

function card(spot) {
  const destination = `${spot.lat},${spot.lng}`;
  return `
    <article class="spot">
      <div class="spot-top">
        <h3>${spot.icon} ${spot.name}</h3>
        <span class="badge ${spot.status}">${spot.label}</span>
      </div>
      <div class="meta">${spot.access}</div>
      <p>${spot.note}</p>
      <div class="actions">
        <button class="show-map" data-id="${spot.id}">Auf Karte</button>
        <a href="https://www.google.com/maps/dir/?api=1&destination=${destination}" target="_blank" rel="noopener">Navigation ↗</a>
      </div>
    </article>`;
}

function render() {
  const visible = spots.filter(spot => activeFilter === "all" || spot.type === activeFilter);
  document.querySelector("#spots").innerHTML = visible.map(card).join("");
  document.querySelector("#count").textContent = `${visible.length} Orte`;

  spots.forEach(spot => {
    const marker = markers.get(spot.id);
    const shouldShow = visible.includes(spot);
    if (shouldShow && !map.hasLayer(marker)) marker.addTo(map);
    if (!shouldShow && map.hasLayer(marker)) marker.removeFrom(map);
  });

  document.querySelectorAll(".show-map").forEach(button => {
    button.addEventListener("click", () => {
      const spot = spots.find(item => item.id === button.dataset.id);
      map.setView([spot.lat, spot.lng], 14);
      markers.get(spot.id).openPopup();
      document.querySelector("#map").scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
}

spots.forEach(addMarker);
render();

document.querySelectorAll(".filter").forEach(button => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll(".filter").forEach(item => item.classList.toggle("active", item === button));
    render();
  });
});

document.querySelector("#locate").addEventListener("click", () => {
  if (!navigator.geolocation) return alert("Standortbestimmung wird von diesem Browser nicht unterstützt.");
  navigator.geolocation.getCurrentPosition(
    position => {
      const point = [position.coords.latitude, position.coords.longitude];
      L.circleMarker(point, { radius: 8, color: "#fff", weight: 3, fillColor: "#2474b5", fillOpacity: 1 })
        .bindPopup("Dein Standort").addTo(map).openPopup();
      map.setView(point, 13);
    },
    () => alert("Der Standort konnte nicht ermittelt werden. Bitte erlaube den Zugriff in deinem Browser."),
    { enableHighAccuracy: true, timeout: 10000 }
  );
});
