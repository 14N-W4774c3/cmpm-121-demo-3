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
    const cacheData = {
      cell: this.cell,
      coinCount: this.coinCount,
      coins: this.coins,
    };
    return JSON.stringify(cacheData);
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
const DEFAULT_LOCATION: cell = { i: 369894, j: -1220627 };

const CACHE_SPAWN_PROBABILITY: number = 0.1;
const activeCaches: Map<cell, Geocache> = new Map<cell, Geocache>();
const cacheRects: Map<cell, leaflet.Rectangle> = new Map<
  cell,
  leaflet.Rectangle
>();
const storedCaches: Map<cell, string> = new Map<cell, string>();
let cellHistory: cell[] = [];

const playerLocation: cell = { i: 369894, j: -1220627 };
let playerInventory: Geocache = new Geocache(playerLocation);

let geolocationActive: boolean = false;

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
  const oldCache = activeCaches.get(cell);
  if (!oldCache) {
    const newCache = new Geocache(cell);
    newCache.generateCoins();
    activeCaches.set(cell, newCache);

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
    cacheRects.set(cell, cacheRect);
    cacheRect.addTo(map);

    cacheRect.bindPopup(() => {
      const popupDiv = document.createElement("div");
      popupDiv.append(newCache.display(playerInventory));
      popupDiv.append(playerInventory.display(newCache));
      return popupDiv;
    }, { keepInView: true });
    newCache.cachePopup = cacheRect.getPopup();
  } else {
    const oldCacheRect = cacheRects.get(cell);
    if (oldCacheRect) {
      oldCache.cachePopup = oldCacheRect.getPopup();
      oldCacheRect.addTo(map);
    }
  }
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
    if (activeCaches.has(cell)) {
      return;
    }
    const storedCache = storedCaches.get(cell);
    if (storedCache) {
      const newCache = Geocache.fromMomento(storedCache);
      activeCaches.set(cell, newCache);
      storedCaches.delete(cell);
      spawnCache(cell);
      return;
    }
    if (luck([cell.i, cell.j, "spawn"].toString()) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(cell);
    }
  });
}

function cullCaches(): void {
  activeCaches.forEach((cache) => {
    if (
      Math.abs(cache.cell.i - playerLocation.i) > NEIGHBORHOOD_SIZE ||
      Math.abs(cache.cell.j - playerLocation.j) > NEIGHBORHOOD_SIZE
    ) {
      const culledRect = cacheRects.get(cache.cell);
      if (culledRect) {
        culledRect.removeFrom(map);
      }
      const cacheString: string = cache.toMomento();
      storedCaches.set(cache.cell, cacheString);
      activeCaches.delete(cache.cell);
    }
  });
}

function movePlayer(newLocation: cell): void {
  playerLocation.i = newLocation.i;
  playerLocation.j = newLocation.j;
  playerInventory.cell = playerLocation;
  cellHistory.push(playerLocation);
  historyLine.addLatLng(cellToLeaflet(playerLocation));
  historyLine.redraw();
  playerMarker.setLatLng(cellToLeaflet(playerLocation));
  cullCaches();
  map.panTo(cellToLeaflet(playerLocation));
  checkForCaches();
}

function resetGame(): void {
  const confirm: boolean = globalThis.confirm(
    "Are you sure you want to reset the game?",
  );
  if (!confirm) {
    return;
  }
  activeCaches.clear();
  cacheRects.forEach((cacheRect) => {
    cacheRect.removeFrom(map);
  });
  cacheRects.clear();
  storedCaches.clear();
  historyLine.setLatLngs([]);
  playerInventory.coinCount = 0;
  playerInventory.coins = [];
  cellHistory = [];
  updateInventory();
  localStorage.clear();
  movePlayer(DEFAULT_LOCATION);
}

function geolocatePlayer(): void {
  if (!geolocationActive) {
    return;
  }
  navigator.geolocation.getCurrentPosition((position) => {
    movePlayer({
      i: Math.floor((position.coords.latitude - ORIGIN.i) / TILE_DEGREES),
      j: Math.floor((position.coords.longitude - ORIGIN.j) / TILE_DEGREES),
    });
  });
}

function updateGame(): void {
  geolocatePlayer();
  requestAnimationFrame(updateGame);
}

function saveGame(): void {
  const cacheMomentos: string[] = [];
  activeCaches.forEach((cache) => {
    cacheMomentos.push(cache.toMomento());
  });
  storedCaches.forEach((cacheMomento) => {
    cacheMomentos.push(cacheMomento);
  });
  localStorage.setItem("caches", JSON.stringify(cacheMomentos));
  localStorage.setItem("inventory", playerInventory.toMomento());
  localStorage.setItem("history", JSON.stringify(cellHistory));
}

function loadGame(): void {
  const playerInventoryMomento = localStorage.getItem("inventory");
  if (playerInventoryMomento) {
    playerInventory = Geocache.fromMomento(playerInventoryMomento);
  }
  const cacheMomentos = localStorage.getItem("caches");
  if (cacheMomentos) {
    const cacheData = JSON.parse(cacheMomentos);
    cacheData.forEach((cacheMomento: string) => {
      const newCache = Geocache.fromMomento(cacheMomento);
      activeCaches.set(newCache.cell, newCache);
      spawnCache(newCache.cell);
    });
  }
  const historyString = localStorage.getItem("history");
  if (historyString) {
    cellHistory = JSON.parse(historyString);
    playerLocation.i = cellHistory[cellHistory.length - 1].i;
    playerLocation.j = cellHistory[cellHistory.length - 1].j;
    playerInventory.cell = playerLocation;
    playerMarker.setLatLng(cellToLeaflet(playerLocation));
    map.panTo(cellToLeaflet(playerLocation));
  }
  cullCaches();
}

// ----------Event Handlers----------------------------------

geolocationButton.addEventListener("click", () => {
  if (geolocationActive) {
    geolocationActive = false;
    return;
  }
  geolocationActive = true;
});

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

resetButton.addEventListener("click", resetGame);

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

if (localStorage.getItem("caches")) {
  loadGame();
}

let path: leaflet.LatLng[] = [];
if (cellHistory.length > 1) {
  path = cellHistory.map((cell) => cellToLeaflet(cell));
} else {
  path = [cellToLeaflet(playerLocation)];
}
const historyLine = leaflet.polyline(path, { color: "white" });
historyLine.addTo(map);

globalThis.addEventListener("beforeunload", () => {
  saveGame();
});

updateInventory();
checkForCaches();
if (geolocationActive) {
  updateGame();
}
