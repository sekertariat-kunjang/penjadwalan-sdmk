# Panduan Deployment Aplikasi Penjadwalan SDMK ke PythonAnywhere

Panduan ini berisi langkah-langkah lengkap untuk mendeploy aplikasi **Penjadwalan SDMK Puskesmas Kunjang** dari repository GitHub ke [PythonAnywhere](https://www.pythonanywhere.com/).

---

## 🛠️ Prasyarat
1. Repository GitHub sudah ter-update: `https://github.com/sekertariat-kunjang/penjadwalan-sdmk.git`
2. Akun PythonAnywhere (Akun gratis/Beginner sudah mencukupi).

---

## 📥 Langkah 1: Clone Repository di PythonAnywhere

1. Login ke akun [PythonAnywhere](https://www.pythonanywhere.com/).
2. Buka tab **Consoles** pada menu navigasi atas.
3. Klik pada **$ Bash** untuk membuka terminal online.
4. Masukkan perintah berikut untuk melakukan clone project:
   ```bash
   git clone https://github.com/sekertariat-kunjang/penjadwalan-sdmk.git
   cd penjadwalan-SDMK
   ```

---

## 📦 Langkah 2: Buat Virtual Environment & Install Dependencies

1. Di dalam terminal Bash PythonAnywhere yang sama, jalankan perintah berikut untuk membuat Virtual Environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
2. Install library yang dibutuhkan dari `requirements.txt`:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

---

## 🗄️ Langkah 3: Setup Database (SQLite)

File database SQLite (`instance/puskesmas_sdmk.db`) sudah disertakan di repository. 

Jika ingin mereset atau mengisi ulang data awal secara bersih, Anda dapat menjalankan:
```bash
python seed.py
```

---

## 🌐 Langkah 4: Konfigurasi Web App di Dashboard PythonAnywhere

1. Klik menu **Web** (ikon globe) di bagian kanan atas halaman PythonAnywhere.
2. Klik tombol **Add a new web app**.
3. Klik **Next** -> Pilih **Manual configuration** (Jangan pilih Flask otomatis agar kita bisa mengatur WSGI dan Virtualenv secara custom).
4. Pilih versi Python: **Python 3.10** (atau 3.11).
5. Klik **Next** hingga selesai.

### Pengaturan Path di Tab Web:
Setelah Web App dibuat, isi bagian-bagian berikut di halaman **Web**:

- **Source code**: `/home/USERNAME_ANDA/penjadwalan-SDMK`
- **Working directory**: `/home/USERNAME_ANDA/penjadwalan-SDMK`
- **Virtualenv**: `/home/USERNAME_ANDA/penjadwalan-SDMK/venv`

*(Pastikan mengganti `USERNAME_ANDA` dengan username PythonAnywhere Anda)*

---

## 📄 Langkah 5: Edit File Konfigurasi WSGI

1. Masih di tab **Web**, cari bagian **Code** -> klik link **WSGI configuration file** (biasanya bernama `/var/www/USERNAME_ANDA_pythonanywhere_com_wsgi.py`).
2. Hapus seluruh isi default file tersebut, lalu ganti dengan kode berikut:

```python
import sys
import os

# 1. Path ke direktori proyek Anda
project_home = '/home/USERNAME_ANDA/penjadwalan-SDMK'
if project_home not in sys.path:
    sys.path.insert(0, project_home)

# 2. Environment variable opsional
os.environ['SECRET_KEY'] = 'ganti-dengan-secret-key-aman-anda'

# 3. Import aplikasi Flask (WSGI callable harus bernama 'application')
from app import app as application
```
*(Ganti `USERNAME_ANDA` sesuai username akun Anda)*

3. Klik tombol **Save** di pojok kanan atas.

---

## 🚀 Langkah 6: Reload & Uji Coba Aplikasi

1. Kembali ke tab **Web**.
2. Klik tombol hijau berukuran besar: **Reload USERNAME_ANDA.pythonanywhere.com**.
3. Buka URL aplikasi Anda di browser:
   `https://USERNAME_ANDA.pythonanywhere.com`

---

## 🔄 Pembaruan Kode Selanjutnya (Update/Redeploy)

Setiap kali Anda mengubah kode di lokal dan melakukan `git push` ke GitHub, cara mengupdatenya di PythonAnywhere sangat mudah:

1. Buka **Bash Console** di PythonAnywhere.
2. Jalankan:
   ```bash
   cd ~/penjadwalan-SDMK
   git pull origin main
   ```
3. Buka tab **Web** lalu klik tombol **Reload**.
