# Konteks Chat Session 08 - Konsultasi Keamanan Database & Troubleshooting Hosting PythonAnywhere

## Dynamic Context
- **Tanggal/Waktu**: 03 September 2026
- **Pengguna**: Admin / Sekretariat Puskesmas Kunjang
- **Tujuan**: Konsultasi strategi keamanan database SQLite saat terjadi gangguan hosting di PythonAnywhere, diagnosa error `ERR_CONNECTION_TIMED_OUT`, serta penyiapan sesi baru untuk mengimplementasikan fitur Backup Database.

## Ringkasan Pembahasan & Hasil Analisis

### 1. Keamanan Database SQLite vs Hosting & GitHub
- **Status Database**: Aplikasi menggunakan SQLite (`instance/puskesmas_sdmk.db`).
- **Karakteristik Data**: Data terbaru yang diinputkan pengguna tersimpan di file `.db` dalam server PythonAnywhere dan **tidak otomatis ter-push ke GitHub**.
- **Solusi Migrasi Hosting**: Jika ganti hosting, file `puskesmas_sdmk.db` harus di-download manual dari folder `instance/` di PythonAnywhere dan di-upload ke folder `instance/` pada hosting baru agar data tidak hilang.

### 2. Diagnosa Error `ERR_CONNECTION_TIMED_OUT` (pythonanywhere.com)
- **Gejala**: Browser tidak dapat membuka `pythonanywhere.com` dengan pesan `took too long to respond`.
- **Hasil Pengecekan Sistem**: Server pusat PythonAnywhere terkonfirmasi **ONLINE & Normal**.
- **Penyebab**: Hambatan rute jaringan (*routing timeout*) / DNS dari ISP lokal di Indonesia (seperti Indihome/Telkomsel/XL) ke IP server PythonAnywhere.
- **Solusi Cepat Teruji**:
  1. Mengaktifkan **Cloudflare WARP (1.1.1.1)** atau **VPN** pada perangkat.
  2. Membuka melalui **Paket Data Seluler HP (Tethering)**.

### 3. Rencana Tindak Lanjut untuk Sesi Baru (Session 09)
Di sesi berikutnya, kita akan mengimplementasikan fitur pencegahan data loss:
1. **Fitur Backup Database Instan di Web App**:
   - Menambahkan API endpoint `/api/admin/backup-db` di `app.py`.
   - Menambahkan tombol **"Download Backup Database"** di menu Admin pada UI Web (`index.html` / `main.js`), sehingga Admin dapat men-download file `.db` kapan saja tanpa perlu membuka dashboard PythonAnywhere.
2. **Opsi Jangka Panjang (Cloud Database)**:
   - Menyiapkan integrasi ke Managed Cloud Database (seperti Supabase / Neon PostgreSQL) memanfaatkan environment variable `DATABASE_URL` yang sudah ada di `app.py`.

---
*Dokumen ini dibuat sebagai rujukan context untuk sesi obrolan selanjutnya.*
