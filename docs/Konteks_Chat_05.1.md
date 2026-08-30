# Konteks Diskusi & Resume Pengembangan App Penjadwalan SDMK Puskesmas (Sesi 05.1)

**Tanggal Resume:** 30 Agustus 2026  
**Git Branch Active:** `main`  
**Fokus Pengembangan Sesi 05.1:** Perbaikan CRUD Kelola Pegawai (Tombol Edit & Hapus), Code Audit Menyeluruh, & Implementasi 15 Security/Quality Fix.

---

## 🛠️ 1. Perbaikan Tombol Edit & Hapus di Panel Kelola Pegawai

### Masalah
- **Tombol Hapus** tidak berfungsi — `window.confirm()` browser diblokir oleh webview/setting modern.
- **Tombol Edit** sudah berfungsi sebagai UPDATE (bukan INSERT baru) — dikonfirmasi melalui browser subagent debug test.

### Solusi yang Diterapkan (`static/js/main.js`)

1. **Inline Delete Confirmation** — menggantikan `deletePegawaiConfirm()` yang bergantung pada `confirm()`:
   - `promptDeletePegawai(id)`: Mengubah kolom aksi baris tabel secara inline menjadi "Yakin? [Ya, Hapus] [Batal]".
   - `executeDeletePegawai(id)`: Mengirim request DELETE ke `/api/pegawai/delete` dan menyegarkan tabel.
   - Pola konsisten dengan inline confirmation yang sudah ada di `promptDeleteRuangan()`.

2. **Refactor Tabel Pegawai** — setiap baris diberi `id="pegawai-row-${p.id}"` dan wrapper `<span id="pegawai-action-${p.id}">` untuk targeting DOM yang tepat.

3. **Window Exports Diperbarui**:
   - Tambah: `window.promptDeletePegawai`, `window.executeDeletePegawai`
   - Hapus: `window.deletePegawaiConfirm` (deprecated)

---

## 🔍 2. Code Audit Menyeluruh

Audit dilakukan terhadap seluruh berkas: `app.py`, `models.py`, `seed.py`, `import_excel.py`, `static/js/main.js`.

Ditemukan **23 isu** terbagi:
- Kritis (5): security vulnerability
- Tinggi (7): code smell & bug potensial
- Sedang (11): kualitas kode & standar

---

## 🔒 3. Implementasi 15 Security & Quality Fix

### Kritis (4 fix di app.py)

1. **Auth logic terbalik** — `if curr_user and curr_user.role == 'pegawai': return 403`
   - MASALAH: jika tidak login (curr_user=None), kondisi False → akses DIIZINKAN!
   - FIX: Ganti ke guard function `require_privileged(curr_user)` di 7 endpoint
   ```python
   def require_privileged(curr_user):
       if not curr_user or curr_user.role not in ROLES.PRIVILEGED:
           return jsonify({...}), 403
       return None
   # Penggunaan: err = require_privileged(get_current_user()); if err: return err
   ```

2. **Submit jadwal tanpa role check** — siapapun bisa trigger action submit
   - FIX: Tambah `if curr_u.role != ROLES.ADMIN: return 403`

3. **debug=True production** — Werkzeug debugger aktif, eksekusi kode arbitrer
   - FIX: `os.environ.get('DEBUG', 'false').lower() == 'true'`

4. **Hardcoded secret key** `'puskesmas-sdmk-secret-key-2026'`
   - FIX: `os.environ.get('SECRET_KEY') or os.urandom(32)`

### Tinggi (5 fix)

5. **XSS** — `u.pegawai_nama` tidak di-escape di `renderUserProfile` (main.js)
   - FIX: `escapeHtml(u.pegawai_nama)` dan `escapeHtml(u.role)`

6. **Crash bulan pendek** — `datetime(year, month, 31)` crash Feb/Apr/Jun/Sep/Nov (seed.py:178)
   - FIX: `calendar.monthrange(year, month)[1]`

7. **`Query.get()` deprecated** (SQLAlchemy 2.0) di banyak tempat di app.py
   - FIX: `db.session.get(Model, id)` di semua tempat

8. **N+1 query** — lazy load shift/ruangan/pegawai per jadwal (ratusan query)
   - FIX: `joinedload(Jadwal.shift, .ruangan, .pegawai)` di fungsi `get_data()`

9. **Duplikasi kode** — blok error konflik identik 2x di update_jadwal
   - FIX: Ekstrak `_build_conflict_error(assignment)` helper function

### Sedang (6 fix)

10. **Magic string literal** tersebar — `'admin'`, `'DRAFT'`, `'L'`, `'C'`, dll.
    - FIX: class `ROLES`, class `STATUS`, konstanta `SHIFT_OFF_CODES`

11. **Default bulan hardcoded** `month: 8` di main.js
    - FIX: `new Date().getMonth() + 1` (dinamis ke bulan saat ini)

12. **Validasi `urutan` tidak aman** — crash jika non-integer dikirim
    - FIX: `try/except (ValueError, TypeError)` + cek nilai negatif

13. **Internal error di-expose** ke client via `str(e)` di import endpoint
    - FIX: Pisah `ValueError` vs `Exception`, pakai `app.logger.exception()`

14. **Race condition** upload file — 2 user upload nama sama ditimpa
    - FIX: `NamedTemporaryFile(delete=False)` + `finally` cleanup

15. **Tidak ada validasi range** di `bulk_jadwal` (end_date < start_date)
    - FIX: `if d_end < d_start: return 400`

### Verifikasi Security Fix (unauthenticated harus 403)

```
[/api/pegawai/add]    HTTP 403  OK
[/api/pegawai/delete] HTTP 403  OK
[/api/ruangan/add]    HTTP 403  OK
[/api/jadwal/update]  HTTP 403  OK
[/api/jadwal/bulk]    HTTP 403  OK
Login admin + add:    HTTP 200  OK
```

---

## 📁 4. Ringkasan Berkas Terlibat Sesi 05.1

- `app.py` — Security fix auth, konstanta ROLES/STATUS/SHIFT_OFF_CODES, joinedload, helper functions, debug mode, secret key env var.
- `seed.py` — Fix end_date hardcoded bulan 31 → calendar.monthrange; import calendar.
- `static/js/main.js` — Inline delete confirmation pegawai (prompt/execute), fix XSS escapeHtml, default bulan dinamis.
- `templates/index.html` — Bump cache version v=20260830_v7.
- `docs/Konteks_Chat_05.1.md` — Berkas dokumentasi resume sesi 05.1 (file ini).
