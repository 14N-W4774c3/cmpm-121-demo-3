// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

// Deterministic random number generator
import _luck from "./luck.ts";

// Page Element Setup
const gameTitle: string = "Geocoins";

document.title = gameTitle;
const header = document.createElement("h1");
header.textContent = gameTitle;
document.body.appendChild(header);

const gameContainer = document.createElement("div");
document.body.appendChild(gameContainer);

const gameControlContainer = document.createElement("div");
gameContainer.appendChild(gameControlContainer);

const gameMap = document.createElement("div");
gameMap.id = "map";
gameContainer.appendChild(gameMap);

const cacheContainer = document.createElement("div");
gameContainer.appendChild(cacheContainer);

const inventoryContainer = document.createElement("div");
gameContainer.appendChild(inventoryContainer);

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

// Interfaces and Variables
interface cell {
  i: number;
  j: number;
  cacheID: number;
}

interface cache {
  cacheID: number;
  cell: cell;
  marker: leaflet.Marker;
  coinCount: number;
  coins: coin[];
}

interface coin {
  i: number;
  j: number;
  serial: number;
}

const inventory: coin[] = [];
let coinCount: number = 0;
const _userPosition: cell = { i: 0, j: 0, cacheID: -1 };

// Functions
function _collectCoin(coin: coin, cache: cache) {
  inventory.push(coin);
  coinCount++;
  cache.coins.splice(cache.coins.indexOf(coin), 1);
  cache.coinCount--;
}

function _depositCoin(coin: coin, cache: cache) {
  inventory.splice(inventory.indexOf(coin), 1);
  coinCount--;
  cache.coins.push(coin);
  cache.coinCount++;
}
