# Konteks Chat 01: Dashboard Penjadwalan SDMK Puskesmas

**Tanggal Penyimpanan:** 26 Agustus 2026  
**Proyek:** Aplikasi Penjadwalan Harian SDMK (Sumber Daya Manusia Kesehatan) Puskesmas  
**Lokasi Repository:** `d:\penjadwalan-SDMK`  

---

## 📑 Ringkasan Eksekutif & Tujuan Proyek

Aplikasi ini dibangun untuk memenuhi kebutuhan Kepala Puskesmas dan Tim Manajemen SDMK dalam mengelola dan menampilkan penjadwalan harian seluruh pegawai di berbagai unit, pos, ruangan, dan poliklinik Puskesmas.

Aplikasi ini menggunakan **Python (Flask)** sebagai backend karena efisiensi, kecepatan pengembangan, dan kestabilannya. Tampilan dibuat modern bertema **Tailwind CSS Dark Mode** dengan aksen **Emerald/Teal Puskesmas**, serta dirancang sesuai standar **Integrasi Layanan Primer (ILP)** Puskesmas (Klaster 1 hingga Klaster 5 serta Luar Induk).

---

## 🏗️ Spesifikasi Teknologi (Tech Stack)

* **Backend Framework:** Python 3 + Flask + Flask-SQLAlchemy (ORM).
* **Database:** SQLite (`instance/puskesmas_sdmk.db`) — ringan, portabel, tanpa perlu instalasi server DB terpisah.
* **Excel Processing:** `openpyxl` (ekspor rekapitulasi jadwal ke format Excel `.xlsx` yang sudah diformat dan diberi warna).
* **Frontend UI & Styling:** 
  * Tailwind CSS v3 (Sleek Dark Mode theme: `bg-slate-950`, `bg-slate-900`, `border-slate-800`, `text-slate-100`).
  * Vanilla Javascript (ES6+) + HTML5 Drag and Drop API.
  * Lucide Icons & Google Fonts (Inter).

---

## 📁 Struktur Berkas Proyek & Fungsi Berkelanjutan

```
d:\penjadwalan-SDMK\
├── app.py                  # Server Flask utama, REST API endpoints, routing & handler export Excel
├── models.py               # Definisi tabel SQLite ORM SQLAlchemy (Pegawai, Ruangan, Shift, Jadwal, User, StatusJadwal)
├── seed.py                 # Script generator data awal (Shift, Ruangan Klaster ILP, Pegawai, User, Sampel Jadwal)
├── excel_exporter.py       # Modul khusus pembuatan file Excel (.xlsx) bertema profesional
├── requirements.txt        # Dependensi modul Python (Flask, Flask-SQLAlchemy, openpyxl)
├── instance/
│   └── puskesmas_sdmk.db   # File fisik database SQLite
├── static/
│   └── js/
│       └── main.js         # Logika frontend (AJAX API, Drag & Drop, Switcher Tab, Filter, Render Grid & Mobile Cards)
├── templates/
│   └── index.html          # Layout dashboard utama, header, filter, tab views, modal form & bulk mapping
└── docs/
    └── Konteks_Chat_01.md  # Berkas dokumentasi konteks proyek ini
```

---

## 🗄️ Skema Database (`models.py`)

1. **`Pegawai`**: `id`, `nip`, `nama`, `profesi` (Dokter, Bidan, Perawat, Apoteker, Gizi, Sanitarian, TU, dll.), `no_hp`.
2. **`Ruangan`**: `id`, `nama`, `kode`, `klaster` (Klaster 1 Manajemen, Klaster 2 Ibu & Anak, Klaster 3 Dewasa & Lansia, Klaster 4 Penanggulangan Penyakit, Klaster 5 Lintas Klaster, Luar Induk), `urutan`.
3. **`Shift`**: `id`, `kode` (P, S, M, ON, L, C), `nama`, `jam_masuk`, `jam_keluar`, `warna_bg`, `warna_text`.
4. **`Jadwal`**: `id`, `tanggal`, `pegawai_id`, `ruangan_id`, `shift_id`, `catatan`.
5. **`User`**: `id`, `username`, `password_hash`, `role` (`admin`, `kapus`, `pegawai`), `pegawai_id`.
6. **`StatusJadwal`**: `id`, `tahun`, `bulan`, `status` (`DRAFT`, `SUBMITTED`, `FINAL`), `approved_by`, `approved_at`.

---

## 💡 Fitur Utama yang Telah Diimplementasikan

1. **Multi-Tab Dynamic Views:**
   * **Tab 1: Matriks Klaster ILP (Ruang vs Tanggal):** Tampilan utama tabel koordinat dengan *Sticky Header* (Tanggal) & *Sticky Left Column* (Ruangan).
   * **Tab 2: View By Profesi:** Pengelompokan jadwal berdasarkan kategori profesi pegawai.
   * **Tab 3: View By Tanggal / Harian (Mobile Friendly):** Tampilan berbentuk kartu per tanggal yang sangat nyaman dibuka via HP.
   * **Tab 4: View By Pegawai:** Kartu personal pegawai yang dapat diklik untuk melihat jadwal 1 bulan penuh dan statistik shift.
2. **Input & Mapping Cepat:**
   * **Drag & Drop:** Menggeser elemen Shift/Pegawai dari palet samping langsung ke sel tabel tanggal/ruangan.
   * **Bulk Mapping (Pengisian Masal):** Modal popup untuk memetakan jadwal pegawai secara masal pada rentang tanggal tertentu.
3. **Fitur Deteksi Bentrok (Anti-Conflict):** Otomatis mendeteksi jika seorang pegawai ditugaskan di 2 tempat berbeda pada tanggal yang sama.
4. **Export Excel Instan:** Sekali klik untuk mengunduh rekapitulasi jadwal bulanan dalam format `.xlsx`.

---

## 🛠️ Panduan Operasional

### 1. Cara Menjalankan Aplikasi
```powershell
cd d:\penjadwalan-SDMK
python app.py
```
Aplikasi dapat diakses via browser di `http://127.0.0.1:5000`.

### 2. Cara Mengisi / Mengganti Data Riil Pegawai & Ruangan
* **Cara 1 (Edit `seed.py`):** Buka [`seed.py`](file:///d:/penjadwalan-SDMK/seed.py), sesuaikan array `pegawai_data` dan `ruangan_data`, lalu jalankan `python seed.py` di terminal.
* **Cara 2 (Via Database GUI):** Buka file `instance/puskesmas_sdmk.db` menggunakan aplikasi gratis **DB Browser for SQLite** atau ekstensi VS Code **SQLite Viewer**.

---

## 📌 Rencana & Diskusi Selanjutnya

1. Pembuatan script import data pegawai & ruangan otomatis dari file Excel (`.xlsx`).
2. Penambahan UI Management Pegawai & Ruangan langsung dari browser (Crud Web Admin).
3. Pengembangan modul statistik jam kerja, beban kerja pegawai, dan rekapitulasi shift bulanan.
