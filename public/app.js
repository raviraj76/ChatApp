const socket = io();

const usernameInput = document.getElementById("username");
const messageInput = document.getElementById("message");
const sendBtn = document.getElementById("send");
const messagesDiv = document.getElementById("messages");
const typingDiv = document.getElementById("typing");
const statusSpan = document.getElementById("status");
const activeUsersList = document.getElementById("active-users");

const dpInput = document.getElementById("dpInput");
const uploadDpBtn = document.getElementById("uploadDpBtn");
const dpImg = document.getElementById("dpImg");

const videoBtn = document.getElementById("startVideo");
const audioBtn = document.getElementById("startAudio");
const disconnectBtn = document.getElementById("disconnectCall");
const videosDiv = document.getElementById("videos");

let localStream;
let peer;
const userDPs = {};
let localUsername = "";

// Set Username
usernameInput.addEventListener("change", () => {
    localUsername = usernameInput.value.trim();
    if (localUsername) socket.emit("setUsername", localUsername);
});

// Messaging
function sendMessage() {
    const username = usernameInput.value.trim();
    const message = messageInput.value.trim();
    if (!username) { alert("Enter username!"); return; }
    if (!message) return;

    const data = { username, message, dp: userDPs[username] || dpImg.src || null, time: new Date() };

    appendMessage(data, true); // Show locally immediately
    socket.emit("chatMessage", data); // Send to others
    messageInput.value = "";
}

sendBtn.addEventListener("click", sendMessage);

messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
    else if (usernameInput.value) socket.emit("typing", usernameInput.value);
});

function appendMessage(data, self = false) {
    const div = document.createElement("div");
    div.classList.add("message");
    div.classList.add(self ? "self" : "other");

    const dpSrc = data.dp || userDPs[data.username] || null;
    if (dpSrc) {
        const img = document.createElement("img");
        img.src = dpSrc;
        img.width = 30;
        img.height = 30;
        img.style.borderRadius = "50%";
        img.style.marginRight = "5px";
        div.appendChild(img);
    }

    const text = document.createElement("span");
    text.innerText = ` ${data.message || ""}`;
    div.appendChild(text);

    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Socket Events
socket.on("chatMessage", (data) => {
    // Show incoming messages only if they are not from me
    if (data.username !== localUsername) appendMessage(data, false);
});

socket.on("typing", (user) => {
    typingDiv.innerText = `${user} is typing...`;
    setTimeout(() => typingDiv.innerText = "", 1500);
});

socket.on("activeUsers", (users) => {
    activeUsersList.innerHTML = "";
    users.forEach(user => {
        const li = document.createElement("li");
        li.innerText = user;
        activeUsersList.appendChild(li);
    });
});

socket.on("connect", () => {
    statusSpan.innerText = "🟢 Online";
    statusSpan.style.color = "limegreen";
});
socket.on("disconnect", () => {
    statusSpan.innerText = "🔴 Offline";
    statusSpan.style.color = "red";
});

// DP Upload
uploadDpBtn.addEventListener("click", () => {
    const file = dpInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        const username = usernameInput.value.trim() || "User";
        userDPs[username] = reader.result;
        dpImg.src = reader.result;
        socket.emit("updateDp", { username, dp: reader.result });
    };
    reader.readAsDataURL(file);
});

socket.on("updateDp", (data) => {
    userDPs[data.username] = data.dp;
    appendMessage({ username: data.username, message: "updated DP", dp: data.dp });
});

// Video / Audio Call
videoBtn.addEventListener("click", () => startCall(true));
audioBtn.addEventListener("click", () => startCall(false));

disconnectBtn.addEventListener("click", () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (peer) peer.destroy();
    videosDiv.innerHTML = "Call disconnected";
    disconnectBtn.style.display = "none";
});

async function startCall(isVideo) {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: isVideo,
            audio: true
        });

        const myVideo = document.createElement("video");
        myVideo.srcObject = localStream;
        myVideo.autoplay = true;
        myVideo.muted = true;
        videosDiv.innerHTML = "";
        videosDiv.appendChild(myVideo);

        peer = new SimplePeer({ initiator: true, trickle: false, stream: localStream });

        peer.on("signal", data => socket.emit("videoSignal", data));

        peer.on("stream", remoteStream => {
            const remoteVideo = document.createElement("video");
            remoteVideo.srcObject = remoteStream;
            remoteVideo.autoplay = true;
            videosDiv.appendChild(remoteVideo);
        });

        disconnectBtn.style.display = "inline-block";

    } catch (err) {
        console.error("Error accessing media devices:", err);
        alert("Cannot access camera/microphone");
    }
}

socket.on("videoSignal", data => {
    if (!peer) {
        peer = new SimplePeer({ initiator: false, trickle: false, stream: localStream });
        peer.on("signal", s => socket.emit("videoSignal", s));
        peer.on("stream", remoteStream => {
            const remoteVideo = document.createElement("video");
            remoteVideo.srcObject = remoteStream;
            remoteVideo.autoplay = true;
            videosDiv.appendChild(remoteVideo);
        });
    }
    peer.signal(data);
});
