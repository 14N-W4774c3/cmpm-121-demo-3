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

class geocache implements cache {
  cell: cell;
  coinCount: number;
  coins: coin[];
  popup: leaflet.Popup | null = null;

  constructor(cell: cell) {
    this.cell = cell;
    this.coinCount = Math.floor(
      luck([cell.i, cell.j, "initialValue"].toString()) * 10,
    );
    this.coins = [];
  }

  display() {
    const cacheDiv = document.createElement("div");
    cacheDiv.textContent =
      `Cache at ${this.cell.i}, ${this.cell.j} has ${this.coinCount} coins.`;
    return cacheDiv;
  }

  addCoin() {
    this.coinCount++;
  }

  takeCoin() {
    this.coinCount--;
  }

  setPopup(popup: leaflet.Popup) {
    this.popup = popup;
  }

  openPopup() {
    if (this.popup) {
      this.popup.openPopup();
    }
  }
}

// Map Variables
const _ORIGIN: cell = { i: 0, j: 0 };
const TILE_DEGREES: number = 1e-4;
const GAMEPLAY_ZOOM_LEVEL: number = 19;
const NEIGHBORHOOD_SIZE: number = 8;
//const map: LeafletMapService = new LeafletMapService();

// Cache Variables
const CACHE_SPAWN_PROBABILITY: number = 0.1;
const caches = new Map<cell, geocache>();

// Game Variables
const _userPosition: cell = { i: 0, j: 0 };
const _inventory: coin[] = [];
let playerCoinCount: number = 0;

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
  let newCache = caches.get({ i, j });
  if (!newCache) {
    newCache = new geocache({ i, j });
    caches.set({ i, j }, newCache);
  }

  // Convert cell numbers into lat/lng bounds
  const origin = OAKES_CLASSROOM;
  const bounds = leaflet.latLngBounds([
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
  ]);

  // Add a rectangle to the map to represent the cache
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  rect.bindPopup(() => {
    const popupDiv = document.createElement("div");
    popupDiv.append(newCache.display());
    const takeCoinButton = document.createElement("button");
    takeCoinButton.textContent = "Take coin";
    popupDiv.append(takeCoinButton);
    const addCoinButton = document.createElement("button");
    addCoinButton.textContent = "Add coin";
    popupDiv.append(addCoinButton);
    addCoinButton.disabled = playerCoinCount === 0;
    takeCoinButton.disabled = newCache.coinCount === 0;
    takeCoinButton.addEventListener("click", () => {
      if (newCache.coinCount > 0) {
        newCache.takeCoin();
        playerCoinCount++;
        updateInventory();
        refreshPopup(newCache);
      }
    });
    addCoinButton.addEventListener("click", () => {
      if (playerCoinCount > 0) {
        newCache.addCoin();
        playerCoinCount--;
        updateInventory();
        refreshPopup(newCache);
      }
    });
    return popupDiv;
  });
}

function checkForCaches(): void {
  for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
      if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
        spawnCache(i, j);
      }
    }
  }
}

function updateInventory(): void {
  userInventory.textContent = `Inventory: ${playerCoinCount} coins`;
}

function refreshPopup(cache: geocache): void {
  if (cache.popup) {
    cache.popup.setContent(() => {
      const popupDiv = document.createElement("div");
      popupDiv.append(cache.display());
      const takeCoinButton = document.createElement("button");
      takeCoinButton.textContent = "Take coin";
      popupDiv.append(takeCoinButton);
      const addCoinButton = document.createElement("button");
      addCoinButton.textContent = "Add coin";
      popupDiv.append(addCoinButton);
      addCoinButton.disabled = playerCoinCount === 0;
      takeCoinButton.disabled = cache.coinCount === 0;
      takeCoinButton.addEventListener("click", () => {
        if (cache.coinCount > 0) {
          cache.takeCoin();
          playerCoinCount++;
          updateInventory();
          refreshPopup(cache);
          takeCoinButton.disabled = cache.coinCount === 0;
        }
      });
      addCoinButton.addEventListener("click", () => {
        if (playerCoinCount > 0) {
          cache.addCoin();
          playerCoinCount--;
          updateInventory();
          refreshPopup(cache);
          addCoinButton.disabled = playerCoinCount === 0;
        }
      });
      return popupDiv;
    });
  }
}
updateInventory();
checkForCaches();

// CURRENT ISSUES
// -Popup does not update on button press, but on reopening the popup
