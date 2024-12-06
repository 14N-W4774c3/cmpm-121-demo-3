// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

// Deterministic random number generator
import luck from "./luck.ts";

// ----------UI Elements-------------------------------------
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

// ----------Interfaces and Classes--------------------------
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
  cachePopup: leaflet.Popup | undefined;

  constructor(cell: cell) {
    this.cell = cell;
    this.coinCount = 0;
    this.coins = [];
  }

  display(otherCache: Geocache): HTMLDivElement {
    const cacheDiv = document.createElement("div");
    cacheDiv.textContent =
      `Cache at ${this.cell.i}, ${this.cell.j} has ${this.coinCount} coins.`;
    for (let i = 0; i < this.coinCount; i++) {
      const coinDiv = document.createElement("div");
      coinDiv.textContent = `Coin ${this.cell.i}:${this.cell.j}#${i}`;
      const coinButton = makeButton(
        "Transfer",
        () => transferCoin(this, otherCache, this.coins[i]),
      );
      coinDiv.appendChild(coinButton);
      cacheDiv.appendChild(coinDiv);
    }
    return cacheDiv;
  }

  updatePopup(otherCache: Geocache): void {
    if (this.cachePopup) {
      this.cachePopup.setContent(() => {
        const popupDiv = document.createElement("div");
        popupDiv.append(this.display(otherCache));
        popupDiv.append(otherCache.display(this));
        return popupDiv;
      });
    } else {
      return;
    }
  }

  generateCoins(): void {
    this.coinCount = Math.floor(
      luck([this.cell.i, this.cell.j, "initialValue"].toString()) * 10 + 1,
    );
    this.coins = [];
    for (let i = 0; i < this.coinCount; i++) {
      this.coins.push({ cell: this.cell, serial: i });
    }
  }

  toMomento(): string {
    return JSON.stringify(this);
  }

  static fromMomento(momento: string): Geocache {
    const cacheData = JSON.parse(momento);
    const newCache = new Geocache(cacheData.cell);
    newCache.coinCount = cacheData.coinCount;
    newCache.coins = cacheData.coins;
    return newCache;
  }
}

// ----------Variables---------------------------------------

const TILE_DEGREES: number = 1e-4;
const GAMEPLAY_ZOOM_LEVEL: number = 19;
const NEIGHBORHOOD_SIZE: number = 8;
const ORIGIN: cell = { i: 0, j: 0 };

const CACHE_SPAWN_PROBABILITY: number = 0.1;
const caches = new Map<cell, Geocache>();

const playerLocation: cell = { i: 369894, j: -1220627 };
const playerInventory: Geocache = new Geocache(playerLocation);

// ----------Utility Functions--------------------------------

function cellToLeaflet(cell: cell): leaflet.LatLng {
  return leaflet.latLng(
    ORIGIN.i + cell.i * TILE_DEGREES,
    ORIGIN.j + cell.j * TILE_DEGREES,
  );
}

function makeButton(buttonText: string, action: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.textContent = buttonText;
  button.addEventListener("click", action);
  return button;
}

// ----------Game Functions----------------------------------

function getNearbyCells(currentCell: cell): cell[] {
  const nearbyCells: cell[] = [];
  for (
    let i = currentCell.i - NEIGHBORHOOD_SIZE;
    i < currentCell.i + NEIGHBORHOOD_SIZE;
    i++
  ) {
    for (
      let j = currentCell.j - NEIGHBORHOOD_SIZE;
      j < currentCell.j + NEIGHBORHOOD_SIZE;
      j++
    ) {
      nearbyCells.push({ i, j });
    }
  }
  return nearbyCells;
}

function spawnCache(cell: cell): void {
  let newCache = caches.get(cell);
  if (!newCache) {
    newCache = new Geocache(cell);
    newCache.generateCoins();
    caches.set(cell, newCache);
  }

  // Convert cell numbers into lat/lng bounds
  const bounds = leaflet.latLngBounds([
    [
      ORIGIN.i + cell.i * TILE_DEGREES,
      ORIGIN.j + cell.j * TILE_DEGREES,
    ],
    [
      ORIGIN.i + (cell.i + 1) * TILE_DEGREES,
      ORIGIN.j + (cell.j + 1) * TILE_DEGREES,
    ],
  ]);

  const cacheRect = leaflet.rectangle(bounds);
  cacheRect.addTo(map);

  cacheRect.bindPopup(() => {
    const popupDiv = document.createElement("div");
    popupDiv.append(newCache.display(playerInventory));
    popupDiv.append(playerInventory.display(newCache));
    return popupDiv;
  }, { keepInView: true });
  newCache.cachePopup = cacheRect.getPopup();
}

function updateInventory(): void {
  let inventoryString = "Inventory: ";
  inventoryString += playerInventory.coinCount + " coins";
  if (playerInventory.coinCount > 0) {
    for (const coin of playerInventory.coins) {
      inventoryString += `\nCoin ${coin.cell.i}:${coin.cell.j} #${coin.serial}`;
    }
  }
  inventoryContainer.textContent = inventoryString;
}

function transferCoin(from: Geocache, to: Geocache, geoCoin: coin): void {
  from.coins = from.coins.filter((coin) => coin !== geoCoin);
  from.coinCount--;
  to.coins.push(geoCoin);
  to.coinCount++;
  updateInventory();
  from.updatePopup(to);
  to.updatePopup(from);
}

function checkForCaches(): void {
  const visibleCells = getNearbyCells(playerLocation);
  visibleCells.forEach((cell) => {
    if (
      luck([cell.i, cell.j, "cacheSpawn"].toString()) < CACHE_SPAWN_PROBABILITY
    ) {
      spawnCache(cell);
    }
  });
}

function movePlayer(newLocation: cell): void {
  playerLocation.i = newLocation.i;
  playerLocation.j = newLocation.j;
  playerMarker.setLatLng(cellToLeaflet(playerLocation));
  map.setView(cellToLeaflet(playerLocation));
  checkForCaches();
}

// ----------Event Handlers----------------------------------

upButton.addEventListener("click", () => {
  movePlayer({ i: playerLocation.i + 1, j: playerLocation.j });
});

downButton.addEventListener("click", () => {
  movePlayer({ i: playerLocation.i - 1, j: playerLocation.j });
});

leftButton.addEventListener("click", () => {
  movePlayer({ i: playerLocation.i, j: playerLocation.j - 1 });
});

rightButton.addEventListener("click", () => {
  movePlayer({ i: playerLocation.i, j: playerLocation.j + 1 });
});

// ----------Game Logic--------------------------------------

const map = leaflet.map(document.getElementById("map")!, {
  center: cellToLeaflet(playerLocation),
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
  closePopupOnClick: false,
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

updateInventory();
checkForCaches();
