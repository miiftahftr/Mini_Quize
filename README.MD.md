# 🕵️‍♂️ DETEKTIF OS // Kasus Sekolah Lama

> **Aplikasi Web Teka-Teki Misteri Interaktif 3-Tahapan Tanpa Server (*Zero-Backend*) dengan Enkripsi Foto AES-GCM 256-bit.**

![Static Badge](https://img.shields.io/badge/Architecture-Serverless_Single_HTML-167d8d?style=for-the-badge)
![Static Badge](https://img.shields.io/badge/Security-AES--GCM_256--bit-071b2b?style=for-the-badge)
![Static Badge](https://img.shields.io/badge/UI_Style-3D_Claymorphism_OS-d97706?style=for-the-badge)

**DETEKTIF OS** adalah permainan teka-teki investigasi berlatar misteri sekolah tua yang dirancang sebagai wadah kejutan digital (*digital time-capsule* / hadiah interaktif). Pemain harus menelusuri petunjuk, menghindari jalur pengecoh, dan memecahkan kode sandi berlapis untuk membuka brankas foto rahasia di akhir cerita.

---

## ✨ Fitur Utama

* **🧩 Alur Investigasi 3 Babak Bercabang:**
  * **Babak 01 (Loker No. 14):** Menemukan kata sandi dasar yang terhubung langsung ke babak akhir.
  * **Babak 02 (Meja Kelas Lama — *Pengecoh*):** Jebakan alibi palsu yang mengarah ke jalur buntu pada peta investigasi.
  * **Babak 03 (Menara Jam Senja):** Menggabungkan petunjuk Babak 01 dengan kode angka akhir untuk membuka brankas utama.
* **🔐 Keamanan Tanpa Server (*Client-Side Cryptography*):**
  * Menggunakan **Web Crypto API** bawaan browser (**PBKDF2** + **AES-GCM 256-bit**).
  * Foto rahasia dienkripsi menjadi *ciphertext* di dalam kode sumber—tidak akan bocor meski diintip lewat *Inspect Element* (`F12`) atau tab *Network*.
  * Validasi kunci jawaban tiap babak menggunakan *hash* **SHA-256**.
* **🎨 Antarmuka Tactile 3D Claymorphism Desktop OS:**
  * Dilengkapi papan investigasi bergaya desktop dengan *sticky notes* pastel, ilustrasi diorama 3D *clay*, *timeline* cabang bergaya Git, dok tombol mekanik (*keycaps*), serta log aktivitas *real-time*.
* **🔦 Alat Bantu & Efek Suara Taktil:**
  * **Senter UV:** Mengungkap tinta rahasia dan peringatan jebakan pada dokumen bukti.
  * **Kaca Pembesar 1.75x:** Memeriksa detail kecil pada diorama 3D.
  * **Web Audio API SFX:** Efek suara klik tombol mekanik, gesekan kertas, dan bunyi gembok terbuka tanpa file audio eksternal.
* **📱 Responsif di Desktop & Smartphone:** Navigasi tab otomatis menyesuaikan layar ponsel saat dibuka lewat tautan WhatsApp/media sosial.

---

## 🛠️ Arsitektur & Teknologi

Proyek ini dibangun sebagai **Single-File Standalone Web Application** tanpa dependensi *backend* atau database eksternal:

| Komponen | Teknologi |
| :--- | :--- |
| **Struktur & Styling** | HTML5, CSS3 (Custom Tactile Claymorphism & Responsive Grid) |
| **Logika & Interaktivitas** | Vanilla JavaScript (ES6+) |
| **Kriptografi** | Native Web Crypto API (`AES-GCM`, `PBKDF2`, `SHA-256`) |
| **Audio Sintetis** | Native Web Audio API |
| **Hosting** | Static Deployment (Vercel / GitHub Pages) |

---

## 🚀 Cara Deploy ke Vercel dari GitHub

1. Pastikan file HTML yang sudah dikunci dari mode *Editor Kasus* telah diganti namanya menjadi **`index.html`**.
2. Unggah `index.html` dan `README.md` ini ke repositori GitHub kamu.
3. Buka [Vercel Dashboard](https://vercel.com/new) dan klik **Add New → Project**.
4. Pilih repositori GitHub ini, biarkan pengaturan *Framework Preset* pada **Other** (karena merupakan file statis murni), lalu klik **Deploy**.
5. Tautan siap dibagikan dalam hitungan detik!

---

## 📁 Struktur Repositori

```text
├── index.html      # Aplikasi utama & payload foto terenkripsi (AES-GCM)
└── README.md       # Dokumentasi proyek