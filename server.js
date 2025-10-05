const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = new Server(server);

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, "public")));

let users = {};

// Socket.io
io.on("connection", (socket) => {
    console.log("✅ New connection:", socket.id);

    socket.on("setUsername", (username) => {
        users[socket.id] = username;
        io.emit("activeUsers", Object.values(users));
    });

    socket.on("chatMessage", (data) => {
        socket.broadcast.emit("chatMessage", data);
    });

    socket.on("typing", (username) => {
        socket.broadcast.emit("typing", username);
    });

    socket.on("updateDp", (data) => {
        socket.broadcast.emit("updateDp", data);
    });

    socket.on("videoSignal", (data) => {
        socket.broadcast.emit("videoSignal", data);
    });

    socket.on("disconnect", () => {
        delete users[socket.id];
        io.emit("activeUsers", Object.values(users));
        console.log("❌ Disconnected:", socket.id);
    });
});

// Catch-all route to serve index.html for SPA
app.get("/*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
