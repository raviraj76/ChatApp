const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
const server = http.createServer(app);

// =======================
// CORS Middleware
// =======================
app.use(cors({
    origin: "*", // Change to your frontend URL in production
    methods: ["GET", "POST"]
}));

// =======================
// Serve frontend files
// =======================
const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));

// =======================
// Data Stores
// =======================
const rooms = {};
const users = {};

// =======================
// Socket.io
// =======================
const io = new Server(server, {
    path: "/socket.io",
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on("connection", (socket) => {
    console.log("✅ Socket connected:", socket.id);

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

    socket.on("joinChat", ({ room, username }) => {
        if (!rooms[room]) rooms[room] = new Set();
        rooms[room].add(socket.id);

        socket.join(room);
        socket.data.username = username;

        const otherUsers = Array.from(rooms[room]).filter(id => id !== socket.id);
        socket.emit("usersInRoom", otherUsers);
    });

    socket.on("sendMessage", ({ room, sender, text }) => {
        io.to(room).emit("receiveMessage", { sender, text });
    });

    socket.on("chatMessage", (data) => {
        io.emit("chatMessage", data);
    });

    socket.on("typing", (user) => {
        socket.broadcast.emit("typing", user);
    });

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
// Catch-all route for frontend
// =======================
app.get("/*", (req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
});

// =======================
// Start Server
// =======================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
