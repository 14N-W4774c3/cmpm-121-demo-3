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

class Geocache implements cache {
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
    for (let i = 0; i < this.coinCount; i++) {
      this.coins.push({ cell: cell, serial: i });
    }
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
const TILE_DEGREES: number = 1e-4;
const GAMEPLAY_ZOOM_LEVEL: number = 19;
const NEIGHBORHOOD_SIZE: number = 8;
const ORIGIN: cell = { i: 0, j: 0 };

// Cache Variables
const CACHE_SPAWN_PROBABILITY: number = 0.1;
const caches = new Map<cell, Geocache>();

// Game Variables
const playerInventory: cache = {
  cell: { i: 0, j: 0 },
  coinCount: 0,
  coins: [],
};
const playerLocation: cell = { i: 369894, j: -1220627 };

function cellToLeaflet(cell: cell): leaflet.LatLng {
  return leaflet.latLng(
    ORIGIN.i + cell.i * TILE_DEGREES,
    ORIGIN.j + cell.j * TILE_DEGREES,
  );
}

const map = leaflet.map(document.getElementById("map")!, {
  center: cellToLeaflet(playerLocation),
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

const playerMarker = leaflet.marker(cellToLeaflet(playerLocation));
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

function spawnCache(cell: cell): void {
  let newCache = caches.get(cell);
  if (!newCache) {
    newCache = new Geocache(cell);
    caches.set(cell, newCache);
  }

  // Convert cell numbers into lat/lng bounds
  const origin = ORIGIN;
  const bounds = leaflet.latLngBounds([
    [origin.i + cell.i * TILE_DEGREES, origin.j + cell.j * TILE_DEGREES],
    [
      origin.i + (cell.i + 1) * TILE_DEGREES,
      origin.j + (cell.j + 1) * TILE_DEGREES,
    ],
  ]);

  // Add a rectangle to the map to represent the cache
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  rect.bindPopup(() => {
    const popupDiv = document.createElement("div");
    popupDiv.append(newCache.display());
    const takeCoinButton = makeButton("Take coin", () => takeCoin(newCache));
    popupDiv.append(takeCoinButton);
    const addCoinButton = makeButton("Add coin", () => addCoin(newCache));
    popupDiv.append(addCoinButton);
    addCoinButton.disabled = playerInventory.coinCount === 0;
    takeCoinButton.disabled = newCache.coinCount === 0;
    return popupDiv;
  });
}

function checkForCaches(): void {
  for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
      if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
        spawnCache({ i: playerLocation.i + i, j: playerLocation.j + j });
      }
    }
  }
}

function updateInventory(): void {
  userInventory.textContent = `Inventory: ${playerInventory.coinCount} coins`;
}

function refreshPopup(cache: Geocache): void {
  if (cache.popup) {
    cache.popup.setContent(() => {
      const popupDiv = document.createElement("div");
      popupDiv.append(cache.display());
      const takeCoinButton = makeButton("Take coin", () => takeCoin(cache));
      popupDiv.append(takeCoinButton);
      const addCoinButton = makeButton("Add coin", () => addCoin(cache));
      popupDiv.append(addCoinButton);
      addCoinButton.disabled = playerInventory.coinCount === 0;
      takeCoinButton.disabled = cache.coinCount === 0;
      return popupDiv;
    });
  }
}

function makeButton(buttonText: string, action: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.textContent = buttonText;
  button.addEventListener("click", action);
  return button;
}

function addCoin(cache: Geocache): void {
  if (playerInventory.coinCount > 0) {
    cache.coinCount++;
    playerInventory.coinCount--;
    updateInventory();
    refreshPopup(cache);
  }
}

function takeCoin(cache: Geocache): void {
  if (cache.coinCount > 0) {
    cache.coinCount--;
    playerInventory.coinCount++;
    updateInventory();
    refreshPopup(cache);
  }
}

updateInventory();
checkForCaches();

// CURRENT ISSUES
// -Popup does not update on button press, but on reopening the popup
