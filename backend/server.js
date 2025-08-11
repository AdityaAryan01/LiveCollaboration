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
import chromium from '@sparticuz/chromium';
import cookieParser from "cookie-parser";
import cookie from "cookie";
import jwt from "jsonwebtoken";

// auth / db imports (your files)
import connectDB from './config/db.js'; // your db connection file
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

// CORS Configuration
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    methods: ["GET", "POST"],
    credentials: true,
  })
);

// Mount your auth routes
// accessible: POST /api/users (register), POST /api/users/auth (login), POST /api/users/logout, GET/PUT /api/users/profile (protected)
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
let SYMBOL = process.env.STOCK_SYMBOL ? process.env.STOCK_SYMBOL.replace(/(^"|"$)/g, "") : "IBM";
const FUNCTION = "TIME_SERIES_WEEKLY_ADJUSTED";

// ---------------------- FBRef Scraping Functions ---------------------- //


async function scrapeMatchResults() {
  console.log("\n[SCRAPE START] Starting scraping process at", new Date().toISOString());
  let browser;
  try {
    console.log("[PUPPETEER] Launching browser instance...");

    const isProduction = process.env.NODE_ENV === "production";

    browser = await puppeteer.launch(
      isProduction
        ? {
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
          }
        : {
            headless: "new", // Local dev
          }
    );

    const page = await browser.newPage();
    console.log("[PUPPETEER] New page created");

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
    console.log("[FETCH STOCK] Raw API response keys:", Object.keys(response.data));
    console.log("[FETCH STOCK] First 200 chars of response:", JSON.stringify(response.data).slice(0, 200));

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

// ---------------------- WebSocket Setup ---------------------- //
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174"],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// Socket auth middleware: require valid JWT to connect
// Socket auth middleware: accept token from handshake.auth.token OR cookie
io.use(async (socket, next) => {
  try {
    // 1) Prefer token passed explicitly by client (socket.handshake.auth.token)
    const authToken = socket.handshake?.auth?.token;
    let token = authToken;

    // 2) If not provided, fall back to cookie parse (existing behavior)
    if (!token) {
      const cookieHeader = socket.handshake.headers?.cookie;
      if (!cookieHeader) {
        return next(new Error("Authentication error - no token or cookie"));
      }
      const parsed = cookie.parse(cookieHeader || "");
      token = parsed?.jwt;
      if (!token) {
        return next(new Error("Authentication error - no token found"));
      }
    }

    // verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select("-password");
      if (!user) {
        return next(new Error("Authentication error - user not found"));
      }
      socket.user = user;
      socket.authToken = token; // optional: keep token on socket if needed
      return next();
    } catch (err) {
      console.error("Socket token verify error:", err.message);
      return next(new Error("Authentication error - invalid token"));
    }
  } catch (err) {
    console.error("Socket auth middleware error:", err);
    return next(new Error("Authentication error"));
  }
});



// ---------------------- WebSocket Handling ---------------------- //
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id, socket.user ? `user:${socket.user._id}` : "guest");

  // ======== FOOTBALL ROOM HANDLING ========
  socket.on("joinFootballRoom", (roomId) => {
    if (!roomId) {
      return socket.emit("error", "Room ID is required to join football room.");
    }
    if (!footballRooms.has(roomId)) {
      footballRooms.set(roomId, {
        clients: new Map(),
        data: {},
      });
    }
    const room = footballRooms.get(roomId);

    const username = socket.user?.name || `Guest-${socket.id.slice(0, 5)}`;
    room.clients.set(socket.id, username);
    socket.join(roomId);
    emitRoomClients(footballRooms, roomId);
  });

  socket.on("requestMatchResults", async (roomId) => {
    try {
      if (!roomId) {
        return socket.emit("error", "Room ID is required for match results.");
      }
      console.log(`[WS] Football results request from ${socket.id} for room ${roomId}`);
      const results = await scrapeMatchResults();
      if (footballRooms.has(roomId)) {
        footballRooms.get(roomId).data = results;
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
          clients: new Map(),
        });
      }
      const room = stockRooms.get(roomId);

      const username = socket.user?.name || `Guest-${socket.id.slice(0, 5)}`;
      room.clients.set(socket.id, username);

      socket.join(roomId);
      socket.emit("stockUpdate", room.data);
      emitRoomClients(stockRooms, roomId);
    } catch (error) {
      socket.emit("error", `Stock room join failed: ${error.message}`);
    }
  });

  socket.on("updateSymbol", async ({ symbol, roomId }) => {
    if (!symbol || !roomId) {
      return socket.emit("error", "Invalid updateSymbol payload");
    }
    try {
      SYMBOL = symbol;
      const stockData = await fetchStockData(symbol);
      if (stockRooms.has(roomId)) {
        stockRooms.get(roomId).data = stockData;
        io.to(roomId).emit("stockUpdate", stockData);
      }
    } catch (error) {
      console.error("Symbol update error:", error);
      socket.emit("error", "Failed to update stock symbol");
    }
  });

  // ======== SET USERNAME ========
  socket.on("setUsername", ({ roomId, username, type }) => {
    const roomMap = type === "football" ? footballRooms : stockRooms;
    if (roomMap.has(roomId)) {
      const room = roomMap.get(roomId);
      if (room.clients.has(socket.id)) {
        // respect DB username if present (don't overwrite)
        if (socket.user) {
          room.clients.set(socket.id, socket.user.name);
        } else {
          room.clients.set(socket.id, username?.trim() || `Guest-${socket.id.slice(0, 5)}`);
        }
        emitRoomClients(roomMap, roomId);
      }
    }
  });

  // ======== DISCONNECT HANDLING ========
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    [stockRooms, footballRooms].forEach((roomMap) => {
      roomMap.forEach((room, roomId) => {
        if (room.clients.has(socket.id)) {
          room.clients.delete(socket.id);
          emitRoomClients(roomMap, roomId);
          if (room.clients.size === 0) {
            // garbage collect unused rooms after 5 minutes
            setTimeout(() => roomMap.delete(roomId), 300000);
          }
        }
      });
    });
  });

  function emitRoomClients(roomMap, roomId) {
    if (roomMap.has(roomId)) {
      io.to(roomId).emit("roomClients", Array.from(roomMap.get(roomId).clients.values()));
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
      if (error) return res.status(500).send("Upload failed");
      io.emit("fileUploaded", result.secure_url);
      res.json({ fileUrl: result.secure_url });
    }
  ).end(file.buffer);
});


// ---------------------- Serve Frontend in Production ---------------------- //
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../live-collabs/dist")));

  app.get("*", (req, res) =>
    res.sendFile(path.resolve(__dirname, "../live-collabs/dist", "index.html"))
  );
}


// ---------------------- Error Handlers ---------------------- //
app.use(notFound);
app.use(errorHandler);


// ---------------------- Server Initialization ---------------------- //
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

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
