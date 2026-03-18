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

        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        const database = firebase.database();
        const onlineUsersRef = database.ref('online_status');

        // --- 2. Real-time Presence Logic ---
        const amOnline = database.ref('.info/connected');
        amOnline.on('value', (snapshot) => {
            if (snapshot.val() === true) {
                // เมื่อเราเชื่อมต่อ (เข้าเว็บ) สร้าง Node ใหม่ใต้ online_status
                const myRef = onlineUsersRef.push();
                
                // เมื่อเราหลุดการเชื่อมต่อ (ปิดเว็บ) ให้ลบ Node นี้ทิ้ง
                myRef.onDisconnect().remove();
                myRef.set(true);
            }
        });

        // ฟังการเปลี่ยนแปลงของจำนวน Node เพื่ออัปเดต UI
        onlineUsersRef.on('value', (snapshot) => {
            const count = snapshot.numChildren();
            document.getElementById('online-count').innerText = count;
        });

        // --- 3. UI Functions ---
        function openModal(title, desc, imgSrc) {
            document.getElementById('modalTitle').innerText = title;
            document.getElementById('modalDesc').innerText = desc;
            document.getElementById('modalImg').src = imgSrc;
            document.getElementById('projectModal').style.display = "block";
        }

        function closeModal() {
            document.getElementById('projectModal').style.display = "none";
        }

        window.onclick = function(event) {
            let modal = document.getElementById('projectModal');
            if (event.target == modal) {
                closeModal();
            }
        }