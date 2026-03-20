// --- 1. Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyAnPDK7to2DWFnti490ri8YRCBkpTajOHY",
    authDomain: "pokdeng-61c5e.firebaseapp.com",
    databaseURL: "https://pokdeng-61c5e-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "pokdeng-61c5e",
    storageBucket: "pokdeng-61c5e.firebasestorage.app",
    messagingSenderId: "518814980796",
    appId: "1:518814980796:web:32b310d1a0b2bc7d058eb9",
    measurementId: "G-BL0BWF915J"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// --- 2. Presence & Counter Logic ---
const onlineUsersRef = database.ref('online_status');
const amOnline = database.ref('.info/connected');

amOnline.on('value', (snapshot) => {
    if (snapshot.val() === true) {
        const myRef = onlineUsersRef.push();
        myRef.onDisconnect().remove();
        myRef.set(true);
    }
});

onlineUsersRef.on('value', (snapshot) => {
    document.getElementById('online-count').innerText = snapshot.numChildren();
});

// --- 3. WebRTC Logic ---
const pcConfig = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }] // Google STUN server
};

let localStream = null;
let peerConnection = null;
const callsRef = database.ref('calls');

// ฟังก์ชันเริ่มกล้อง
async function startMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('localVideo').srcObject = localStream;
        document.getElementById('startBtn').disabled = true;
        document.getElementById('startBtn').innerText = "กำลังเชื่อมต่อ...";
        initCall();
    } catch (e) {
        alert("ไม่สามารถเข้าถึงกล้องได้: " + e.message);
    }
}

// ฟังก์ชันสร้าง/รอรับการเชื่อมต่อ
async function initCall() {
    peerConnection = new RTCPeerConnection(pcConfig);

    // ส่ง Stream ของเราไปหาคนอื่น
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    // รับ Stream จากคนอื่นมาแสดงผล
    peerConnection.ontrack = (event) => {
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo.srcObject !== event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
        }
    };

    // ตรวจสอบว่ามี "สายเรียกเข้า" (Offer) หรือไม่
    const snapshot = await callsRef.once('value');
    if (!snapshot.exists()) {
        // เป็นคนสร้างห้อง (Caller)
        makeOffer();
    } else {
        // เป็นคนรับสาย (Answerer)
        answerCall();
    }
}

async function makeOffer() {
    const callRef = callsRef.child('active_call');
    
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            callRef.child('callerCandidates').push(event.candidate.toJSON());
        }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    await callRef.set({
        offer: { type: offer.type, sdp: offer.sdp }
    });

    // ฟังคำตอบจากอีกฝั่ง
    callRef.on('value', async (snap) => {
        const data = snap.val();
        if (!peerConnection.currentRemoteDescription && data?.answer) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
    });

    // รับ ICE candidates จากอีกฝั่ง
    callRef.child('answerCandidates').on('child_added', (snap) => {
        peerConnection.addIceCandidate(new RTCIceCandidate(snap.val()));
    });
}

async function answerCall() {
    const callRef = callsRef.child('active_call');
    const data = (await callRef.once('value')).val();

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            callRef.child('answerCandidates').push(event.candidate.toJSON());
        }
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    await callRef.update({
        answer: { type: answer.type, sdp: answer.sdp }
    });

    // รับ ICE candidates จากฝั่งคนโทร
    callRef.child('callerCandidates').on('child_added', (snap) => {
        peerConnection.addIceCandidate(new RTCIceCandidate(snap.val()));
    });
}

// Event Listeners
document.getElementById('startBtn').addEventListener('click', startMedia);

// เมื่อปิดเว็บ ให้ล้างข้อมูลการโทร (เพื่อให้คนต่อไปใช้งานได้)
window.onbeforeunload = () => {
    callsRef.remove();
};
