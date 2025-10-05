const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 5000;

// Serve static frontend files
app.use(express.static(path.join(__dirname, "public")));

let users = {};

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  // Set username
  socket.on("setUsername", (username) => {
    users[socket.id] = username;
    io.emit("activeUsers", Object.values(users));
  });

  // Chat message
  socket.on("chatMessage", (data) => {
    socket.broadcast.emit("chatMessage", data);
  });

  // Typing indicator
  socket.on("typing", (username) => {
    socket.broadcast.emit("typing", username);
  });

  // Update DP
  socket.on("updateDp", (data) => {
    socket.broadcast.emit("updateDp", data);
  });

  // Video/Audio call signaling
  socket.on("videoSignal", (data) => {
    socket.broadcast.emit("videoSignal", data);
  });

  // Disconnect
  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("activeUsers", Object.values(users));
    console.log("Disconnected:", socket.id);
  });
});

// ✅ Catch-all route for SPA (this fixes the Render crash)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
