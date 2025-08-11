// server.js (merged with auth)
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import multer from "multer";
import cloudinary from "cloudinary";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import axios from "axios";
import puppeteer from "puppeteer";
import chromium from "@sparticuz/chromium";
import cookieParser from "cookie-parser";
import cookie from "cookie";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";

// auth / db imports (your files)
import connectDB from "./config/db.js"; // your db connection file
import userRoutes from "./routes/userRoutes.js";
import User from "./models/userModel.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// Middleware for JSON and cookies
app.use(express.json());
app.use(cookieParser());

// ====== Allowed origins (include your deployed front) ======
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://livecollaboration.onrender.com",
];

// CORS Configuration
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  })
);

// Mount your auth routes
app.use("/api/users", userRoutes);

// Initialize Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// Configure Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ---------------------- Stock Data Setup ---------------------- //
const API_KEY = process.env.ALPHA_VANTAGE_KEY;
let SYMBOL = process.env.STOCK_SYMBOL
  ? process.env.STOCK_SYMBOL.replace(/(^"|"$)/g, "")
  : "IBM";
const FUNCTION = "TIME_SERIES_WEEKLY_ADJUSTED";

// ---------------------- Puppeteer / Scraping utils ---------------------- //
let scrapeLock = {
  inProgress: false,
  cachedResults: null,
  lastRun: 0,
};

// Debug helper
function debugLog(...args) {
  console.log("[SERVER DEBUG]", ...args);
}

// ---------------------- FBRef Scraping Functions ---------------------- //
async function scrapeMatchResults() {
  debugLog("[SCRAPE START] Starting scraping at", new Date().toISOString());
  debugLog("ENV:", {
    NODE_ENV: process.env.NODE_ENV,
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD,
    PORT: process.env.PORT,
  });

  let browser;
  try {
    debugLog("[PUPPETEER] Preparing launch options (isProduction?)", process.env.NODE_ENV === "production");

    if (process.env.NODE_ENV === "production") {
      // Try to get the executable path first (for debug)
      try {
        const exePath = await chromium.executablePath();
        debugLog("[PUPPETEER] chromium.executablePath() ->", exePath);
      } catch (e) {
        debugLog("[PUPPETEER] chromium.executablePath() threw:", e && e.message);
      }

      browser = await puppeteer.launch({
        args: [
          ...chromium.args,
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-zygote",
        ],
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    } else {
      // Local dev - use default Puppeteer behavior
      browser = await puppeteer.launch({ headless: "new" });
    }

    const page = await browser.newPage();
    debugLog("[PUPPETEER] New page created");

    const teamUrls = {
      Arsenal:
        "https://fbref.com/en/squads/18bb7c10/2024-2025/matchlogs/c9/schedule/Arsenal-Scores-and-Fixtures-Premier-League",
      Chelsea:
        "https://fbref.com/en/squads/cff3d9bb/2024-2025/matchlogs/c9/schedule/Chelsea-Scores-and-Fixtures-Premier-League",
      "Manchester City":
        "https://fbref.com/en/squads/b8fd03ef/2024-2025/matchlogs/c9/schedule/Manchester-City-Scores-and-Fixtures-Premier-League",
      Liverpool:
        "https://fbref.com/en/squads/822bd0ba/2024-2025/matchlogs/c9/schedule/Liverpool-Scores-and-Fixtures-Premier-League",
      "Nottingham Forest":
        "https://fbref.com/en/squads/e4a775cb/2024-2025/matchlogs/c9/schedule/Nottingham-Forest-Scores-and-Fixtures-Premier-League",
    };

    const allResults = {};

    for (const [team, url] of Object.entries(teamUrls)) {
      debugLog(`[SCRAPER] Processing ${team} -> ${url}`);
      const start = Date.now();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

      try {
        await page.waitForSelector("table.stats_table", { timeout: 15000 });
        const results = await page.$$eval("td[data-stat='result']", (cells) =>
          cells.map((cell) => cell.textContent.trim().charAt(0).toUpperCase())
        );
        allResults[team] = results;
        debugLog(`[SCRAPER] ${team} results (first 6):`, results.slice(0, 6));
      } catch (error) {
        debugLog(`[ERROR] Failed to scrape ${team}:`, error && error.message);
        allResults[team] = [];
      } finally {
        debugLog(`[SCRAPER] ${team} took ${Date.now() - start}ms`);
      }
    }

    return allResults;
  } catch (error) {
    debugLog("[ERROR] Scraping process failed:", error && error.stack ? error.stack : error);
    return {};
  } finally {
    if (browser) {
      try {
        await browser.close();
        debugLog("[PUPPETEER] Browser closed successfully");
      } catch (e) {
        debugLog("[PUPPETEER] Browser close error:", e && e.message);
      }
    }
    debugLog("[SCRAPE END] Process completed at", new Date().toISOString());
  }
}

// ---------------------- Room Management ---------------------- //
const stockRooms = new Map(); // roomId -> { data, clients: Map<socketId, username> }
const footballRooms = new Map(); // roomId -> { data, clients: Map<socketId, username> }

// ---------------------- Stock Data Functions ---------------------- //
async function fetchStockData(symbol) {
  try {
    const response = await axios.get("https://www.alphavantage.co/query", {
      params: {
        function: FUNCTION,
        symbol,
        apikey: API_KEY,
      },
    });
    debugLog("[FETCH STOCK] Raw API response keys:", Object.keys(response.data || {}));
    debugLog("[FETCH STOCK] Preview:", JSON.stringify(response.data || {}).slice(0, 200));

    if (response.data["Error Message"]) {
      debugLog("API Error:", response.data["Error Message"]);
      return [];
    }

    const rawData = response.data["Weekly Adjusted Time Series"];
    return rawData
      ? Object.entries(rawData)
          .map(([date, values]) => ({
            date,
            open: parseFloat(values["1. open"]),
            high: parseFloat(values["2. high"]),
            low: parseFloat(values["3. low"]),
            close: parseFloat(values["4. close"]),
            adjustedClose: parseFloat(values["5. adjusted close"]),
            volume: parseInt(values["6. volume"]),
            dividend: parseFloat(values["7. dividend amount"]),
          }))
          .reverse()
      : [];
  } catch (error) {
    debugLog("Error fetching stock data:", error && error.message);
    return [];
  }
}

// ---------------------- WebSocket Setup ---------------------- //
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// Socket auth middleware: accept token from handshake.auth.token OR cookie
io.use(async (socket, next) => {
  try {
    const authToken = socket.handshake?.auth?.token;
    let token = authToken;

    if (!token) {
      const cookieHeader = socket.handshake.headers?.cookie;
      if (!cookieHeader) {
        debugLog("[SOCKET AUTH] No cookie header found on handshake");
        return next(new Error("Authentication error - no token or cookie"));
      }
      const parsed = cookie.parse(cookieHeader || "");
      token = parsed?.jwt;
      if (!token) {
        debugLog("[SOCKET AUTH] No jwt in cookies");
        return next(new Error("Authentication error - no token found"));
      }
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select("-password");
      if (!user) {
        debugLog("[SOCKET AUTH] User not found for decoded token");
        return next(new Error("Authentication error - user not found"));
      }
      socket.user = user;
      socket.authToken = token;
      return next();
    } catch (err) {
      debugLog("[SOCKET AUTH] Token verify error:", err && err.message);
      return next(new Error("Authentication error - invalid token"));
    }
  } catch (err) {
    debugLog("[SOCKET AUTH] Middleware error:", err && err.message);
    return next(new Error("Authentication error"));
  }
});

// ---------------------- WebSocket Handling ---------------------- //
io.on("connection", (socket) => {
  debugLog("Client connected:", socket.id, socket.user ? `user:${socket.user._id}` : "guest");

  // ======== FOOTBALL ROOM HANDLING ========
  socket.on("joinFootballRoom", (roomId) => {
    debugLog("[WS] joinFootballRoom request", { socketId: socket.id, roomId });

    if (!roomId) {
      return socket.emit("error", "Room ID is required to join football room.");
    }
    if (!footballRooms.has(roomId)) {
      footballRooms.set(roomId, { clients: new Map(), data: {} });
    }
    const room = footballRooms.get(roomId);

    const username = socket.user?.name || `Guest-${socket.id.slice(0, 5)}`;
    room.clients.set(socket.id, username);
    socket.join(roomId);
    debugLog(`[ROOM] ${roomId} clients after join:`, Array.from(room.clients.values()));
    emitRoomClients(footballRooms, roomId);
  });

  socket.on("requestMatchResults", async (roomId) => {
    try {
      if (!roomId) {
        return socket.emit("error", "Room ID is required for match results.");
      }
      debugLog(`[WS] Football results request from ${socket.id} for room ${roomId}`);

      // if another scrape is running, return cached result to avoid multiple puppeteer launches
      if (scrapeLock.inProgress) {
        debugLog("[SCRAPER] Scrape already in progress - returning cached results");
        const cached = scrapeLock.cachedResults || {};
        if (footballRooms.has(roomId)) footballRooms.get(roomId).data = cached;
        io.to(roomId).emit("matchResults", cached);
        return;
      }

      try {
        scrapeLock.inProgress = true;
        const results = await scrapeMatchResults();
        scrapeLock.cachedResults = results;
        scrapeLock.lastRun = Date.now();
        if (footballRooms.has(roomId)) footballRooms.get(roomId).data = results;
        io.to(roomId).emit("matchResults", results);
      } finally {
        scrapeLock.inProgress = false;
      }
    } catch (error) {
      debugLog("[WS ERROR] Football results request failed:", error && error.stack ? error.stack : error);
      socket.emit("error", "Failed to fetch match results");
    }
  });

  // ======== STOCK ROOM HANDLING ========
  socket.on("joinStockRoom", async (roomId) => {
    debugLog("[WS] joinStockRoom request", { socketId: socket.id, roomId });
    try {
      if (!roomId) {
        return socket.emit("error", "Room ID is required to join stock room.");
      }
      if (!stockRooms.has(roomId)) {
        stockRooms.set(roomId, {
          data: await fetchStockData(SYMBOL),
          clients: new Map(),
        });
      }
      const room = stockRooms.get(roomId);

      const username = socket.user?.name || `Guest-${socket.id.slice(0, 5)}`;
      room.clients.set(socket.id, username);

      socket.join(roomId);
      socket.emit("stockUpdate", room.data);
      debugLog(`[ROOM STOCK] ${roomId} clients after join:`, Array.from(room.clients.values()));
      emitRoomClients(stockRooms, roomId);
    } catch (error) {
      debugLog("[WS ERROR] joinStockRoom failed:", error && error.message);
      socket.emit("error", `Stock room join failed: ${error.message}`);
    }
  });

  socket.on("updateSymbol", async ({ symbol, roomId }) => {
    if (!symbol || !roomId) {
      return socket.emit("error", "Invalid updateSymbol payload");
    }
    try {
      debugLog("[WS] updateSymbol", { symbol, roomId, by: socket.id });
      SYMBOL = symbol;
      const stockData = await fetchStockData(symbol);
      if (stockRooms.has(roomId)) {
        stockRooms.get(roomId).data = stockData;
        io.to(roomId).emit("stockUpdate", stockData);
      }
    } catch (error) {
      debugLog("Symbol update error:", error && error.message);
      socket.emit("error", "Failed to update stock symbol");
    }
  });

  // ======== SET USERNAME ========
  socket.on("setUsername", ({ roomId, username, type }) => {
    const roomMap = type === "football" ? footballRooms : stockRooms;
    if (roomMap.has(roomId)) {
      const room = roomMap.get(roomId);
      if (room.clients.has(socket.id)) {
        if (socket.user) {
          room.clients.set(socket.id, socket.user.name);
        } else {
          room.clients.set(socket.id, username?.trim() || `Guest-${socket.id.slice(0, 5)}`);
        }
        debugLog(`[ROOM USERNAME] ${roomId} now:`, Array.from(room.clients.values()));
        emitRoomClients(roomMap, roomId);
      }
    }
  });

  // ======== DISCONNECT HANDLING ========
  socket.on("disconnect", () => {
    debugLog("Client disconnected:", socket.id);
    [stockRooms, footballRooms].forEach((roomMap) => {
      roomMap.forEach((room, roomId) => {
        if (room.clients.has(socket.id)) {
          room.clients.delete(socket.id);
          emitRoomClients(roomMap, roomId);
          if (room.clients.size === 0) {
            setTimeout(() => roomMap.delete(roomId), 300000);
          }
        }
      });
    });
  });

  function emitRoomClients(roomMap, roomId) {
    if (roomMap.has(roomId)) {
      const clients = Array.from(roomMap.get(roomId).clients.values());
      debugLog(`[EMIT roomClients] ${roomId} ->`, clients);
      io.to(roomId).emit("roomClients", clients);
    }
  }
});

// ---------------------- File Upload Endpoint ---------------------- //
app.post("/upload", upload.single("file"), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).send("No file uploaded.");

  cloudinary.v2.uploader.upload_stream(
    { resource_type: "auto", public_id: uuidv4() },
    (error, result) => {
      if (error) {
        debugLog("Cloudinary upload failed:", error && error.message);
        return res.status(500).send("Upload failed");
      }
      io.emit("fileUploaded", result.secure_url);
      res.json({ fileUrl: result.secure_url });
    }
  ).end(file.buffer);
});

// ---------------------- Serve Frontend in Production ---------------------- //
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../live-collabs/dist")));

  app.get("*", (req, res) =>
    res.sendFile(path.resolve(__dirname, "../live-collabs/dist", "index.html"))
  );
} else {
  // helpful local root route so visiting server root doesn't 404 in dev
  app.get("/", (req, res) => {
    res.send("LiveCollaboration backend running (dev)");
  });
}

// health route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ---------------------- Error Handlers ---------------------- //
app.use(notFound);
app.use(errorHandler);

// ---------------------- Server Initialization ---------------------- //
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  debugLog(`Server running on port ${PORT} (NODE_ENV=${process.env.NODE_ENV})`);

  // periodic stock refresh
  setInterval(async () => {
    const newStockData = await fetchStockData(SYMBOL);
    stockRooms.forEach((room, roomId) => {
      if (newStockData && room.clients.size > 0) {
        room.data = newStockData;
        io.to(roomId).emit("stockUpdate", newStockData);
      }
    });
  }, 300000);
});
