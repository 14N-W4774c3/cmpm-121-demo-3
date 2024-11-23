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

// UI Elements
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

// Inventory and Cache Elements (TO BE ADJUSTED)
const userInventory = document.createElement("div");
userInventory.textContent = "Inventory";
inventoryContainer.appendChild(userInventory);

const cacheInventory = document.createElement("div");
cacheInventory.textContent = "Caches";
cacheContainer.appendChild(cacheInventory);

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

interface MapService {
  initialize(parentElement: HTMLElement, center: cell, zoom: number): void;
  setView(center: cell, zoom: number): void;
  addMarker(position: cell, popupElement: HTMLElement): void;
  addRectangle(bounds: cell[]): void;
  clear(): void;
}

class LeafletMapService implements MapService {
  private map: leaflet.Map;

  constructor() {
    this.map = leaflet.map("map", {
      center: [0, 0],
      zoom: 1,
      minZoom: 1,
      maxZoom: 19,
      zoomControl: false,
      scrollWheelZoom: false,
    });
    leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(this.map);
  }

  initialize(parentElement: HTMLElement, center: cell, zoom: number): void {
    parentElement.innerHTML = "<div id='map' style='height: 100%;'></div>";
    this.map.setView([center.i, center.j], zoom);
    leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(this.map);
  }

  setView(center: cell, zoom: number): void {
    this.map.setView([center.i, center.j], zoom);
  }

  addMarker(position: cell, popupElement: HTMLElement): void {
    leaflet.marker([position.i, position.j]).bindPopup(popupElement).addTo(
      this.map,
    );
  }

  addRectangle(bounds: cell[]): void {
    leaflet.rectangle([[bounds[0].i, bounds[0].j], [bounds[1].i, bounds[1].j]])
      .addTo(this.map);
  }

  clear(): void {
    this.map.remove();
  }
}
// Map Variables
const _ORIGIN: cell = { i: 0, j: 0 };
const _TILE_DEGREES: number = 1e-4;
const GAMEPLAY_ZOOM_LEVEL: number = 19;
const NEIGHBORHOOD_SIZE: number = 8;
const map: LeafletMapService = new LeafletMapService();

// Cache Variables
const CACHE_SPAWN_PROBABILITY: number = 0.1;
const caches: cache[] = [];

// Game Variables
const _userPosition: cell = { i: 0, j: 0 };
const _inventory: coin[] = [];
let coinCount: number = 0;

// Events
const inventory_changed: Event = new Event("inventory_changed");
const cache_changed: Event = new Event("cache_changed");

// D3A Variables
const OAKES_CLASSROOM: cell = { i: 36.98949379578401, j: -122.06277128548504 };
const ORIGIN: cell = OAKES_CLASSROOM;

// Inventory Functions
function takeCoin(cache: cache): void {
  if (cache.coinCount > 0) {
    coinCount++;
    cache.coinCount--;
    dispatchEvent(inventory_changed);
    dispatchEvent(cache_changed);
  }
}

function depositCoin(cache: cache): void {
  if (coinCount > 0) {
    coinCount--;
    cache.coinCount++;
    dispatchEvent(inventory_changed);
    dispatchEvent(cache_changed);
  }
}

function updateInventory(): void {
  userInventory.textContent = `Inventory: ${coinCount}`;
}

addEventListener("inventory_changed", updateInventory);

// Cache Functions
function checkForCaches(): void {
  for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
      // If location i,j is lucky enough, spawn a cache!
      if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
        const newCacheCell = { i: i, j: j };
        const newCache = generateCache(newCacheCell);
        caches.push(newCache);
        placeCache(newCache);
      }
    }
  }
}

function generateCache(cacheCell: cell): cache {
  const coinCount = Math.floor(
    luck([cacheCell.i, cacheCell.j, "initialValue"].toString()) * 10,
  );
  // const coins: coin[] = FUNCTION TO GENERATE UNIQUE COINS (NYI)
  const newCache: cache = {
    cell: cacheCell,
    coinCount: coinCount,
    coins: [],
  };
  return newCache;
}

function placePlayer(location: cell): void {
  const playerDiv = document.createElement("div");
  playerDiv.textContent = "You are here!";
  map.addMarker(location, playerDiv);
}

function placeCache(cache: cache): void {
  const cacheDiv = makeCachePopup(cache);
  map.addMarker(cache.cell, cacheDiv);
}

function makeCachePopup(cache: cache): HTMLElement {
  const cacheDiv = document.createElement("div");
  const cacheText = document.createElement("p");
  cacheText.textContent =
    `There is a cache here at "${cache.cell.i}, ${cache.cell.j}". It has value ${cache.coinCount}.`;
  cacheDiv.appendChild(cacheText);
  const takeCoinButton = makeWithdrawalButton(cache);
  cacheDiv.appendChild(takeCoinButton);
  const depositCoinButton = makeDepositButton(cache);
  cacheDiv.appendChild(depositCoinButton);
  cacheDiv.addEventListener("cache_changed", function () {
    updateCacheInventory(cache);
  });
  return cacheDiv;
}

function makeWithdrawalButton(cache: cache): HTMLElement {
  const takeCoinButton = document.createElement("button");
  takeCoinButton.textContent = "Take Coin";
  takeCoinButton.addEventListener("click", () => {
    takeCoin(cache);
  });
  return takeCoinButton;
}

function makeDepositButton(cache: cache): HTMLElement {
  const depositCoinButton = document.createElement("button");
  depositCoinButton.textContent = "Deposit Coin";
  depositCoinButton.addEventListener("click", () => {
    depositCoin(cache);
  });
  return depositCoinButton;
}

function updateCacheInventory(cache: cache): void {
  const cacheDiv = makeCachePopup(cache);
  map.addMarker(cache.cell, cacheDiv);
}

addEventListener("cache_changed", () => {
  caches.forEach((cache: cache) => {
    updateCacheInventory(cache);
  });
});

map.initialize(gameMap, ORIGIN, GAMEPLAY_ZOOM_LEVEL);
placePlayer(_userPosition);
checkForCaches();
