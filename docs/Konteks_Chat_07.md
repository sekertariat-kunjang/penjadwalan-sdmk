# Konteks Chat Session 07 - Fitur Auth Login Admin & Kapus, Modal Kelola Cuti, dan Fix Dropdown Pegawai

## Dynamic Context
- **Tanggal/Waktu**: 31 Agustus 2026
- **Pengguna**: Admin / Sekretariat Puskesmas Kunjang
- **Tujuan**: Membangun antarmuka Autentikasi (Admin & Kapus), mengaktifkan modal pengeditan pegawai Libur/Cuti, serta memperbaiki bug dropdown pegawai yang menghilang saat sedang berstatus Cuti atau bertugas di layanan lain.

## Ringkasan Perubahan & Fitur Baru
1. **Sistem Autentikasi & Modal Login (`#login-modal`)**:
   - Ditambahkan tombol **Login Akun** pada header kanan atas.
   - Ditambahkan modal login modern dengan fitur **⚡ Quick Login (Pilih Akun Cepat)**:
     - **Admin SDMK** (`admin` / `admin123`): Penyusun & pengelola data.
     - **Kepala Puskesmas** (`kapus` / `kapus123`): Persetujuan & pengesahan jadwal (FINAL).
   - Menampilkan badge profil pengguna aktif (`Admin SDMK` / `Kepala Puskesmas`) beserta tombol Logout.

2. **Modal Kelola Pegawai Libur / Cuti (`#modal-off-cell`)**:
   - Baris paling bawah di Matriks Tab 1 (**`🌴 Pegawai Libur / Cuti`**) kini interaktif & dapat diklik oleh Admin/Kapus pada sel tanggal mana saja.
   - Membuka modal khusus `#modal-off-cell` untuk melihat, menambah, mengedit, atau menghapus status Libur (`L`) dan Cuti (`C`) pegawai pada tanggal tersebut.
   - Kalender pribadi pegawai pada **Tab 4 (Detail Pegawai)** kini juga dapat diklik pada setiap sel tanggal untuk membuka modal edit jadwal instan.

3. **Perbaikan Bug Dropdown Pegawai (`updateModalPegawaiDropdown` & `updateModalOffPegawaiDropdown`)**:
   - **Masalah Sebelumnya**: Pegawai yang sedang Cuti/Libur atau piket di layanan lain disembunyikan dari dropdown pilihan (`filter(!assignedStaffIds.includes(p.id))`), sehingga tidak bisa dipilih untuk dipindahkan atau diedit.
   - **Perbaikan**: Seluruh pegawai dalam daftar `pegawai_list` tetap ditampilkan dalam dropdown. Pegawai yang sudah memiliki jadwal pada tanggal tersebut diberi tag penanda transparan, seperti `dr. Durotun Nafisa (Dokter Umum) — [Status Cuti Tahunan]`. Admin/Kapus bebas memilih pegawai tersebut dan saat disimpan, status lamanya otomatis ter-update (*replace*) dengan jadwal baru.

## Git Commit History (Session 07)
- `cdcb5a0`: `feat: implement login modal and quick account switcher for Admin and Kapus`
- `10479f6`: `fix: allow editing & reassigning staff currently on cuti or assigned elsewhere`

## Cara Pull & Update di PythonAnywhere Online
```bash
cd ~/penjadwalan-sdmk
git pull origin main
```
*Lalu klik Reload pada Web tab di PythonAnywhere.*
