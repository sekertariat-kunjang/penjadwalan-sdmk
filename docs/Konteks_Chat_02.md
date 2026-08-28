# Konteks Diskusi & Resume Pengembangan App Penjadwalan SDMK Puskesmas (Sesi 02)

**Tanggal Resume:** 28 Agustus 2026  
**Git Branch Active:** `feature/ui-redesign`  
**Fokus Pengembangan Sesi 02:** Tab 1 - Matriks Klaster & Layanan (UI/UX, Backend Validation, Multi-Petugas, Anti-Bentrok, & Ringkasan Libur/Cuti).

---

## 📌 1. Rangkuman Aturan Bisnis & Backend Logic (`app.py` & `models.py`)

1. **Validasi Strict Tunggal Penugasan Per Tanggal (*Anti Double-Booking*):**
   - Backend API (`/api/jadwal/update` & `/api/jadwal/bulk`) memvalidasi bahwa seorang pegawai **tidak boleh ditugaskan di lebih dari 1 shift/layanan pada tanggal yang sama**.
   - Jika terjadi duplikasi, server mengembalikan respon HTTP 400 dengan pesan penolakan yang rinci:
     > `⚠️ Gagal! [Nama Pegawai] sudah bertugas di [Nama Layanan] (Shift [Kode]) pada tanggal YYYY-MM-DD. Seorang pegawai tidak dapat ditugaskan 2 kali pada tanggal yang sama.`
2. **Dukungan Multi-Petugas Per Layanan (Multiple Staff per Room):**
   - Satu ruangan/layanan (misal: *IGD*, *Ruang Rawat Inap*, *Poli Umum*) dapat menampung lebih dari 1 pegawai bertugas pada tanggal yang sama.
3. **Pemisahan Dinas Aktif vs Status Libur/Cuti:**
   - Sel matriks ruangan/layanan **hanya menampilkan shift tugas aktif (`Pagi`, `Siang`, `Malam`, `On Call`)**.
   - Status **Libur (`L`)** dan **Cuti (`C`)** adalah status non-dinas personal pegawai dan dialihkan ke baris ringkasan paling bawah serta kalender pribadi pegawai di Tab 4.

---

## 🎨 2. Hasil Redesain & UX Tab 1 (Matriks Klaster & Layanan)

### A. Tampilan Matriks Grid & Badge Pegawai
- **Single Sticky Column (Ruangan / Layanan):**
  - Menggunakan 1 kolom *sticky* (`left: 0`, `z-index: 25`, `bg #0f172a`).
  - Menghapus kolom `No` dan baris pembagi klaster berulang untuk menghemat ruang horizontal.
  - Memperbaiki efek *crosshair hover* dengan latar belakang pekat (`#112d38`) agar sel tanggal yang digeser **100% tidak pernah menembus/overlay di atas nama ruangan**.
- **Tinggi Baris Seragam (Uniform Fixed Row Height ~36px):**
  - Seluruh baris matriks memiliki tinggi tunggal seragam dan tidak pernah melar secara vertikal.
- **Mode Ringkas (`compact`):**
  - Sel menampilkan **Inisial Nama Pegawai** (misal: `AF`, `MI`, `RA`) pada warna latar belakang shift yang telah dikodekan (*color-coded*).
- **Mode Detail (`detail`):**
  - Judul utama (*bold text*) menampilkan **Nama Pegawai**, dan *subtitle* kecil di bawahnya menampilkan **Nama Shift** (misal: `Pagi`, `Siang`).
- **Penanda Multi-Petugas (+N Counter Badge):**
  - Layanan dengan multi-petugas ditandai dengan **Border Emas (`border-amber-400`)** dan **Badge Counter Emas (`+1`, `+2`)** di sebelah kanan.

### B. Baris Ringkasan & Upperbar Control Toolbar
- **Baris Ringkasan `🌴 Pegawai Libur / Cuti` (Bottom Row):**
  - Berada di posisi paling bawah tabel matriks untuk merekap staf yang sedang Libur (`L`) atau Cuti (`C`) pada setiap tanggal.
- **Upperbar Control Toolbar:**
  - `[ ☰ Panel Pegawai ]`: Tombol *toggle collapsible sidebar drawer*.
  - `[ ⬛ Ringkas ]` vs `[ 📄 Detail ]`: Switcher kerapatan visual.
  - **Palet Shift Horizontal**: Badges master shift yang dapat di-drag langsung ke sel.
  - **Quick Filter Chip Upperbar**: Chip kategori klaster dan chip khusus **`[ 🌴 Libur & Cuti ]`** (dapat di-toggle on/off).

### C. Modal Editor & Popover Tooltip
- **Modal Kelola Petugas Layanan (`#modal-cell`):**
  - Menampilkan daftar petugas yang sedang bertugas di layanan tersebut beserta tombol `[Edit]` dan `[Hapus]` per individu.
  - Form penambahan pegawai dilengkapi **Filter Otomatis Dropdown** (hanya menampilkan pegawai yang *belum ditugaskan* pada tanggal tersebut).
  - Dilengkapi banner peringatan merah jika terjadi penolakan sistem.
- **Rich Tooltip Popover (`#rich-tooltip`):**
  - Popover melayang yang menampilkan informasi lengkap pegawai, shift, ruangan, dan catatan saat kursor diarahkan (*hover*) ke sel matriks.

---

## 📁 3. Modifikasi Berkas Utama

- [`app.py`](file:///d:/penjadwalan-SDMK/app.py): Refactoring endpoint API penugasan & validasi duplikasi tanggal.
- [`models.py`](file:///d:/penjadwalan-SDMK/models.py): Struktur ORM Database SDMK.
- [`seed.py`](file:///d:/penjadwalan-SDMK/seed.py): Generator data sampel jadwal yang bersih tanpa pencampuran L/C di sel ruangan.
- [`excel_exporter.py`](file:///d:/penjadwalan-SDMK/excel_exporter.py): Dukungan ekspor Openpyxl untuk sel multi-petugas.
- [`templates/index.html`](file:///d:/penjadwalan-SDMK/templates/index.html): Redesain markup toolbar, sticky column CSS, dan modal multi-petugas.
- [`static/js/main.js`](file:///d:/penjadwalan-SDMK/static/js/main.js): State management, rendering matriks multi-petugas, inisial pegawai, & filter dropdown modal.

---

## 🎯 4. Rencana Kerja Selanjutnya (Sesi 3 - Besok)

Pada sesi berikutnya, pengembangan akan dilanjutkan untuk menyempurnakan tab-tab yang tersisa:
1. **Tab 2: By Profesi / Pekerjaan** (Tampilan matriks yang dikelompokkan berdasarkan profesi pegawai).
2. **Tab 3: View Harian / Mobile Card View** (Tampilan kartu harian berbasis tanggal yang ramah perangkat seluler).
3. **Tab 4: Detail Pegawai** (Tampilan kalender bulanan individu per pegawai).
