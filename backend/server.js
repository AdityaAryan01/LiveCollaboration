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

dotenv.config();

const app = express();
const server = http.createServer(app);

// CORS Configuration
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    methods: ["GET", "POST"],
    credentials: true,
  })
);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174"],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

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
let SYMBOL = "IBM"; // Default symbol
const FUNCTION = "TIME_SERIES_WEEKLY_ADJUSTED";

// ---------------------- FBRef Scraping Functions ---------------------- //
async function scrapeMatchResults() {
  console.log("\n[SCRAPE START] Starting scraping process at", new Date().toISOString());
  let browser;
  try {
    console.log("[PUPPETEER] Launching browser instance...");
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    console.log("[PUPPETEER] New page created");

    const teamUrls = {
      Arsenal: "https://fbref.com/en/squads/18bb7c10/2024-2025/matchlogs/c9/schedule/Arsenal-Scores-and-Fixtures-Premier-League",
      Chelsea: "https://fbref.com/en/squads/cff3d9bb/2024-2025/matchlogs/c9/schedule/Chelsea-Scores-and-Fixtures-Premier-League",
      "Manchester City": "https://fbref.com/en/squads/b8fd03ef/2024-2025/matchlogs/c9/schedule/Manchester-City-Scores-and-Fixtures-Premier-League",
      Liverpool: "https://fbref.com/en/squads/822bd0ba/2024-2025/matchlogs/c9/schedule/Liverpool-Scores-and-Fixtures-Premier-League",
      "Nottingham Forest": "https://fbref.com/en/squads/e4a775cb/2024-2025/matchlogs/c9/schedule/Nottingham-Forest-Scores-and-Fixtures-Premier-League",
    };

    const allResults = {};

    for (const [team, url] of Object.entries(teamUrls)) {
      console.log(`[SCRAPER] Processing ${team}...`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

      try {
        await page.waitForSelector("table.stats_table", { timeout: 15000 });
        const results = await page.$$eval("td[data-stat='result']", (cells) =>
          cells.map((cell) => cell.textContent.trim().charAt(0).toUpperCase())
        );
        allResults[team] = results;
        console.log(`[SCRAPER] ${team} results:`, results.slice(0, 5), "...");
      } catch (error) {
        console.error(`[ERROR] Failed to scrape ${team}:`, error);
        allResults[team] = [];
      }
    }
    return allResults;
  } catch (error) {
    console.error("[ERROR] Scraping process failed:", error);
    return {};
  } finally {
    if (browser) {
      await browser.close();
      console.log("[PUPPETEER] Browser closed successfully");
    }
    console.log("[SCRAPE END] Process completed at", new Date().toISOString());
  }
}

// ---------------------- Room Management ---------------------- //
const stockRooms = new Map();
const footballRooms = new Map();

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

    if (response.data["Error Message"]) {
      console.error("API Error:", response.data["Error Message"]);
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
    console.error("Error fetching stock data:", error);
    return [];
  }
}

// ---------------------- WebSocket Handling ---------------------- //
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // ======== FOOTBALL ROOM HANDLING ========
  socket.on("joinFootballRoom", (roomId) => {
    if (!roomId) {
      return socket.emit("error", "Room ID is required to join football room.");
    }
    if (!footballRooms.has(roomId)) {
      footballRooms.set(roomId, {
        clients: new Set(),
        data: {}, // will hold match results
      });
    }
    const room = footballRooms.get(roomId);
    room.clients.add(socket.id);
    socket.join(roomId);
    io.to(roomId).emit("roomClients", Array.from(room.clients));
  });

  socket.on("requestMatchResults", async (roomId) => {
    try {
      if (!roomId) {
        return socket.emit("error", "Room ID is required for match results.");
      }
      console.log(`[WS] Football results request from ${socket.id} for room ${roomId}`);
      const results = await scrapeMatchResults();
      if (footballRooms.has(roomId)) {
        const room = footballRooms.get(roomId);
        room.data = results;
      }
      io.to(roomId).emit("matchResults", results);
    } catch (error) {
      console.error("[WS ERROR] Football results request failed:", error);
      socket.emit("error", "Failed to fetch match results");
    }
  });

  // ======== STOCK ROOM HANDLING ========
  socket.on("joinStockRoom", async (roomId) => {
    try {
      if (!roomId) {
        return socket.emit("error", "Room ID is required to join stock room.");
      }
      if (!stockRooms.has(roomId)) {
        stockRooms.set(roomId, {
          data: await fetchStockData(SYMBOL),
          clients: new Set(),
        });
      }
      const room = stockRooms.get(roomId);
      room.clients.add(socket.id);
      socket.join(roomId);
      socket.emit("stockUpdate", room.data);
      io.to(roomId).emit("roomClients", Array.from(room.clients));
    } catch (error) {
      socket.emit("error", `Stock room join failed: ${error.message}`);
    }
  });

  socket.on("updateSymbol", async (payload) => {
    if (!payload || !payload.symbol || !payload.roomId) {
      return socket.emit("error", "Invalid updateSymbol payload");
    }
    const { symbol, roomId } = payload;
    try {
      SYMBOL = symbol;
      const stockData = await fetchStockData(symbol);
      if (stockRooms.has(roomId)) {
        const room = stockRooms.get(roomId);
        room.data = stockData;
        io.to(roomId).emit("stockUpdate", stockData);
      }
    } catch (error) {
      console.error("Symbol update error:", error);
      socket.emit("error", "Failed to update stock symbol");
    }
  });

  // ======== DISCONNECT HANDLING ========
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    stockRooms.forEach((room, roomId) => {
      if (room.clients.has(socket.id)) {
        room.clients.delete(socket.id);
        io.to(roomId).emit("roomClients", Array.from(room.clients));
        if (room.clients.size === 0) {
          setTimeout(() => stockRooms.delete(roomId), 300000);
        }
      }
    });

    footballRooms.forEach((room, roomId) => {
      if (room.clients.has(socket.id)) {
        room.clients.delete(socket.id);
        io.to(roomId).emit("roomClients", Array.from(room.clients));
        if (room.clients.size === 0) {
          setTimeout(() => footballRooms.delete(roomId), 300000);
        }
      }
    });
  });
});

// ---------------------- File Upload Endpoint ---------------------- //
app.post("/upload", upload.single("file"), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).send("No file uploaded.");

  cloudinary.v2.uploader.upload_stream(
    { resource_type: "auto", public_id: uuidv4() },
    (error, result) => {
      if (error) return res.status(500).send("Upload failed");
      io.emit("fileUploaded", result.secure_url);
      res.json({ fileUrl: result.secure_url });
    }
  ).end(file.buffer);
});

// ---------------------- Server Initialization ---------------------- //
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Refresh stock data every 5 minutes
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
