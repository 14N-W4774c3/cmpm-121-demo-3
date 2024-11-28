// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

// Deterministic random number generator
import luck from "./luck.ts";

// Page Element Setup
const gameTitle: string = "Geocoins";
let app = document.getElementById("app");
if (!app) {
  app = document.createElement("div");
  app.id = "app";
}

document.title = gameTitle;
const header = document.createElement("h1");
header.textContent = gameTitle;
app.appendChild(header);

const gameControlContainer = document.createElement("div");
app.appendChild(gameControlContainer);

const gameMap = document.createElement("div");
gameMap.id = "map";
app.appendChild(gameMap);

const cacheContainer = document.createElement("div");
app.appendChild(cacheContainer);

const inventoryContainer = document.createElement("div");
app.appendChild(inventoryContainer);

// UI Elements - For D3.c - D3.d
const geolocationButton = document.createElement("button");
geolocationButton.textContent = "🌐";
gameControlContainer.appendChild(geolocationButton);

const upButton = document.createElement("button");
upButton.textContent = "⬆️";
gameControlContainer.appendChild(upButton);

const downButton = document.createElement("button");
downButton.textContent = "⬇️";
gameControlContainer.appendChild(downButton);

const leftButton = document.createElement("button");
leftButton.textContent = "⬅️";
gameControlContainer.appendChild(leftButton);

const rightButton = document.createElement("button");
rightButton.textContent = "➡️";
gameControlContainer.appendChild(rightButton);

const resetButton = document.createElement("button");
resetButton.textContent = "🚮";
gameControlContainer.appendChild(resetButton);

// Inventory and Cache Elements
const userInventory = document.createElement("div");
userInventory.textContent = "Inventory";
inventoryContainer.appendChild(userInventory);

// Interfaces and Classes
interface cell {
  i: number;
  j: number;
}

interface cache {
  cell: cell;
  coinCount: number;
  coins: coin[];
}

interface coin {
  cell: cell;
  serial: number;
}

// Map Variables
const _ORIGIN: cell = { i: 0, j: 0 };
const TILE_DEGREES: number = 1e-4;
const GAMEPLAY_ZOOM_LEVEL: number = 19;
const NEIGHBORHOOD_SIZE: number = 8;
//const map: LeafletMapService = new LeafletMapService();

// Cache Variables
const CACHE_SPAWN_PROBABILITY: number = 0.1;
const _caches: cache[] = [];

// Game Variables
const _userPosition: cell = { i: 0, j: 0 };
const _inventory: coin[] = [];
let coinCount: number = 0;

// Events
const _inventory_changed: Event = new Event("inventory_changed");
const _cache_changed: Event = new Event("cache_changed");

// D3A Variables
const _OAKES_CLASSROOM: cell = { i: 36.98949379578401, j: -122.06277128548504 };
//const ORIGIN: cell = _OAKES_CLASSROOM;

const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);

const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

const playerMarker = leaflet.marker(OAKES_CLASSROOM);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

function spawnCache(i: number, j: number) {
  // Convert cell numbers into lat/lng bounds
  const origin = OAKES_CLASSROOM;
  const bounds = leaflet.latLngBounds([
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
  ]);

  // Add a rectangle to the map to represent the cache
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // Handle interactions with the cache
  rect.bindPopup(() => {
    let pointValue = Math.floor(luck([i, j, "initialValue"].toString()) * 10);

    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
                <div>There is a cache here at "${i},${j}". It has <span id="value">${pointValue}</span> coins.</div>`;
    const takeCoinButton = document.createElement("button");
    takeCoinButton.textContent = "Take coin";
    takeCoinButton.id = "poke";
    popupDiv.append(takeCoinButton);
    const addCoinButton = document.createElement("button");
    addCoinButton.textContent = "Add coin";
    addCoinButton.id = "unpoke";
    popupDiv.append(addCoinButton);
    addCoinButton.disabled = coinCount === 0;
    // Clicking the button decrements the cache's value and increments the player's points
    takeCoinButton.addEventListener("click", () => {
      if (pointValue > 0) {
        pointValue--;
        popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
          pointValue.toString();
        coinCount++;
        updateInventory();
        takeCoinButton.disabled = pointValue === 0;
      }
    });
    addCoinButton.addEventListener("click", () => {
      if (coinCount > 0) {
        pointValue++;
        popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
          pointValue.toString();
        coinCount--;
        updateInventory();
        addCoinButton.disabled = coinCount === 0;
      }
    });
    return popupDiv;
  });
}

function checkForCaches(): void {
  for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
      // If location i,j is lucky enough, spawn a cache!
      if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
        spawnCache(i, j);
      }
    }
  }
}

function updateInventory(): void {
  userInventory.textContent = `Inventory: ${coinCount}`;
}
updateInventory();
checkForCaches();

// CURRENT ISSUES
// -Buttons on cache popups don't change cache coin count persistently
// -Buttons on cache popups only check coin count/cache value on load
