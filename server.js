// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path"); // Added to serve static files

const app = express();
const server = http.createServer(app);

// =======================
// Serve frontend files
// =======================
app.use(express.static(path.join(__dirname, "public"))); // Serve everything in public/

// =======================
// CORS Middleware
// =======================
app.use(cors());

// =======================
// Data Stores
// =======================
const rooms = {};   // { roomId: Set(socketIds) }
const users = {};   // { socketId: { username, dp } }

// =======================
// Socket.io
// =======================
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("✅ Socket connected:", socket.id);

  // USER MANAGEMENT
  socket.on("setUsername", (username) => {
    if (!users[socket.id]) users[socket.id] = {};
    users[socket.id].username = username;
    io.emit("activeUsers", Object.values(users));
  });

  socket.on("updateDp", (data) => {
    if (!users[socket.id]) users[socket.id] = {};
    users[socket.id].dp = data.dp;
    users[socket.id].username = data.username || users[socket.id].username || "User";
    io.emit("activeUsers", Object.values(users));
    io.emit("chatMessage", { username: data.username, message: "updated DP", dp: data.dp });
  });

  // ROOM JOINING
  socket.on("joinChat", ({ room, username }) => {
    if (!rooms[room]) rooms[room] = new Set();
    rooms[room].add(socket.id);

    socket.join(room);
    socket.data.username = username;

    console.log(`${username} joined room: ${room}`);

    const otherUsers = Array.from(rooms[room]).filter(id => id !== socket.id);
    socket.emit("usersInRoom", otherUsers);
  });

  // CHAT
  socket.on("sendMessage", ({ room, sender, text }) => {
    io.to(room).emit("receiveMessage", { sender, text });
  });

  socket.on("chatMessage", (data) => {
    io.emit("chatMessage", data);
  });

  socket.on("typing", (user) => {
    socket.broadcast.emit("typing", user);
  });

  // VIDEO CALL / SIGNALING
  socket.on("callUser", ({ to, signalData, from, name }) => {
    io.to(to).emit("incomingCall", { signal: signalData, from, name });
  });

  socket.on("answerCall", ({ to, signal }) => {
    io.to(to).emit("callAccepted", signal);
  });

  socket.on("iceCandidate", ({ to, candidate }) => {
    io.to(to).emit("iceCandidate", { candidate });
  });

  socket.on("videoSignal", (data) => {
    socket.broadcast.emit("videoSignal", data);
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);

    delete users[socket.id];
    io.emit("activeUsers", Object.values(users));

    for (const room in rooms) {
      rooms[room].delete(socket.id);
      if (rooms[room].size === 0) delete rooms[room];
    }
  });
});

// =======================
// Root Route — Serve Frontend
// =======================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =======================
// Start Server
// =======================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
