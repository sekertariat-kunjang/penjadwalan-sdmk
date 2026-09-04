import os
import calendar
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file, session
from models import db, Pegawai, Ruangan, Shift, Jadwal, User, StatusJadwal
from sqlalchemy.orm import joinedload
from excel_exporter import generate_excel_schedule, INDONESIAN_MONTHS
from import_excel import parse_and_import_excel, generate_excel_template
from werkzeug.utils import secure_filename
import tempfile

# ---------------------------------------------------------------------------
# KONSTANTA TERPUSAT — hindari magic string literal tersebar di seluruh kode
# ---------------------------------------------------------------------------
class ROLES:
    ADMIN  = 'admin'
    KAPUS  = 'kapus'
    PEGAWAI = 'pegawai'
    PRIVILEGED = {'admin', 'kapus'}  # role yang boleh mengubah data

class STATUS:
    DRAFT     = 'DRAFT'
    SUBMITTED = 'SUBMITTED'
    FINAL     = 'FINAL'

SHIFT_OFF_CODES = {'L', 'C'}  # Libur & Cuti — tidak memerlukan ruangan

basedir = os.path.abspath(os.path.dirname(__file__))
db_path = os.path.join(basedir, 'instance', 'puskesmas_sdmk.db')

app = Flask(__name__)
# SECRET_KEY diambil dari environment variable; fallback ke random bytes saat dev
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY') or os.urandom(32)
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
    'DATABASE_URL', f'sqlite:///{db_path}'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# Inisialisasi otomatis tabel & akun default saat aplikasi dimuat
with app.app_context():
    db.create_all()
    try:
        from seed import init_default_users
        init_default_users()
    except Exception as e:
        app.logger.warning(f"Auto init default users warning: {e}")

def get_current_user():
    """Kembalikan objek User yang sedang login, atau None jika belum login."""
    user_id = session.get('user_id')
    if user_id:
        return db.session.get(User, user_id)
    return None

def require_privileged(curr_user):
    """
    Guard function: kembalikan response 403 jika user bukan admin/kapus.
    Gunakan: err = require_privileged(get_current_user()); if err: return err
    """
    if not curr_user or curr_user.role not in ROLES.PRIVILEGED:
        return jsonify({'status': 'error', 'message': 'Akses ditolak. Hanya Admin atau Kepala Puskesmas yang diizinkan.'}), 403
    return None

def get_or_create_status(year, month):
    """Ambil atau buat record StatusJadwal untuk tahun/bulan tertentu."""
    st = StatusJadwal.query.filter_by(tahun=year, bulan=month).first()
    if not st:
        st = StatusJadwal(tahun=year, bulan=month, status=STATUS.DRAFT)
        db.session.add(st)
        db.session.commit()
    return st

def _build_conflict_error(assignment):
    """Buat pesan error konflik jadwal dari objek Jadwal yang sudah ada."""
    peg_name  = assignment.pegawai.nama if assignment.pegawai else 'Pegawai'
    room_name = assignment.ruangan.nama if assignment.ruangan else 'Layanan lain'
    shift_code = assignment.shift.kode if assignment.shift else ''
    return jsonify({
        'status': 'error',
        'message': (
            f'Gagal! {peg_name} sudah bertugas di {room_name} '
            f'(Shift {shift_code}) pada tanggal {assignment.tanggal}. '
            f'Seorang pegawai tidak dapat ditugaskan 2 kali pada tanggal yang sama.'
        )
    }), 400

@app.route('/')
def index():
    return render_template('index.html')

# -------------------------------------------------------------
# AUTH API ENDPOINTS
# -------------------------------------------------------------
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json or {}
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({'status': 'error', 'message': 'Username atau password salah!'}), 401

    session['user_id'] = user.id
    return jsonify({
        'status': 'success',
        'message': f'Selamat datang, {user.username}!',
        'user': user.to_dict()
    })

@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    return jsonify({'status': 'success', 'message': 'Berhasil logout'})

@app.route('/api/me', methods=['GET'])
def get_me():
    user = get_current_user()
    if user:
        return jsonify({'status': 'success', 'user': user.to_dict()})
    return jsonify({'status': 'guest', 'user': None})

# -------------------------------------------------------------
# DATA API ENDPOINT
# -------------------------------------------------------------
@app.route('/api/data', methods=['GET'])
def get_data():
    try:
        year = int(request.args.get('year', datetime.now().year))
        month = int(request.args.get('month', datetime.now().month))
    except ValueError:
        year = datetime.now().year
        month = datetime.now().month

    num_days = calendar.monthrange(year, month)[1]
    start_str = f"{year}-{month:02d}-01"
    end_str = f"{year}-{month:02d}-{num_days:02d}"

    current_u = get_current_user()
    st_obj = get_or_create_status(year, month)

    pegawai_list = [p.to_dict() for p in Pegawai.query.order_by(Pegawai.nama.asc()).all()]
    ruangan_list = [r.to_dict() for r in Ruangan.query.order_by(Ruangan.urutan.asc()).all()]
    shift_list = [s.to_dict() for s in Shift.query.all()]

    # joinedload mencegah N+1 query — relasi shift/ruangan/pegawai di-load sekaligus
    jadwals = (
        Jadwal.query
        .options(
            joinedload(Jadwal.shift),
            joinedload(Jadwal.ruangan),
            joinedload(Jadwal.pegawai)
        )
        .filter(Jadwal.tanggal >= start_str, Jadwal.tanggal <= end_str)
        .all()
    )
    jadwal_list = [j.to_dict() for j in jadwals]

    # Deteksi konflik — pegawai ditugaskan lebih dari sekali dalam sehari
    assignments = {}
    for j in jadwals:
        if j.shift and j.shift.kode not in SHIFT_OFF_CODES:
            key = (j.pegawai_id, j.tanggal)
            assignments.setdefault(key, []).append({
                'ruangan_nama': j.ruangan.nama if j.ruangan else '',
                'shift_kode': j.shift.kode
            })

    conflicts = []
    peg_map = {p['id']: p['nama'] for p in pegawai_list}
    for (peg_id, tgl), room_shifts in assignments.items():
        if len(room_shifts) > 1:
            conflicts.append({
                'tanggal': tgl,
                'pegawai_nama': peg_map.get(peg_id, ''),
                'details': room_shifts
            })

    return jsonify({
        'status': 'success',
        'year': year,
        'month': month,
        'month_name': INDONESIAN_MONTHS[month],
        'num_days': num_days,
        'current_user': current_u.to_dict() if current_u else None,
        'status_jadwal': st_obj.to_dict(),
        'pegawai_list': pegawai_list,
        'ruangan_list': ruangan_list,
        'shift_list': shift_list,
        'jadwal_list': jadwal_list,
        'conflicts': conflicts
    })

# -------------------------------------------------------------
# MASTER RUANGAN / LAYANAN API ENDPOINTS
# -------------------------------------------------------------
@app.route('/api/ruangan/add', methods=['POST'])
def add_ruangan():
    err = require_privileged(get_current_user())
    if err: return err

    data = request.json or {}
    nama = data.get('nama', '').strip()
    kode = data.get('kode', '').strip()
    klaster = data.get('klaster', 'Klaster 1 (Manajemen)').strip()
    try:
        urutan = int(data.get('urutan', 99))
        if urutan < 0:
            urutan = 99
    except (ValueError, TypeError):
        urutan = 99

    if not nama:
        return jsonify({'status': 'error', 'message': 'Nama layanan wajib diisi'}), 400

    new_r = Ruangan(nama=nama, kode=kode, klaster=klaster, urutan=urutan)
    db.session.add(new_r)
    db.session.commit()

    return jsonify({'status': 'success', 'message': 'Layanan baru berhasil ditambahkan', 'ruangan': new_r.to_dict()})

@app.route('/api/ruangan/delete', methods=['POST'])
def delete_ruangan():
    err = require_privileged(get_current_user())
    if err: return err

    data = request.json or {}
    r_id = data.get('id')

    if r_id is None:
        return jsonify({'status': 'error', 'message': 'ID layanan wajib diisi'}), 400

    try:
        r_id = int(r_id)
    except (ValueError, TypeError):
        return jsonify({'status': 'error', 'message': 'ID layanan tidak valid'}), 400

    r = db.session.get(Ruangan, r_id)
    if r:
        room_name = r.nama
        Jadwal.query.filter_by(ruangan_id=r_id).delete()
        db.session.delete(r)
        db.session.commit()
        return jsonify({'status': 'success', 'message': f'Layanan "{room_name}" berhasil dihapus'})

    return jsonify({'status': 'error', 'message': 'Layanan tidak ditemukan'}), 404


# -------------------------------------------------------------
# MASTER PEGAWAI API ENDPOINTS
# -------------------------------------------------------------
@app.route('/api/pegawai/add', methods=['POST'])
def add_pegawai():
    err = require_privileged(get_current_user())
    if err: return err

    data = request.json or {}
    nama = data.get('nama', '').strip()
    profesi = data.get('profesi', '').strip()
    nip = data.get('nip', '').strip()
    no_hp = data.get('no_hp', '').strip()

    if not nama or not profesi:
        return jsonify({'status': 'error', 'message': 'Nama dan profesi wajib diisi!'}), 400

    new_p = Pegawai(nama=nama, profesi=profesi, nip=nip or '-', no_hp=no_hp or '-')
    db.session.add(new_p)
    db.session.commit()

    return jsonify({'status': 'success', 'message': 'Pegawai baru berhasil ditambahkan', 'pegawai': new_p.to_dict()})

@app.route('/api/pegawai/edit', methods=['POST'])
def edit_pegawai():
    err = require_privileged(get_current_user())
    if err: return err

    data = request.json or {}
    p_id = data.get('id')
    if not p_id:
        return jsonify({'status': 'error', 'message': 'ID pegawai wajib diisi'}), 400
    p = db.session.get(Pegawai, int(p_id))
    if not p:
        return jsonify({'status': 'error', 'message': 'Pegawai tidak ditemukan'}), 404

    p.nama = data.get('nama', p.nama).strip()
    p.profesi = data.get('profesi', p.profesi).strip()
    p.nip = data.get('nip', p.nip).strip() or '-'
    p.no_hp = data.get('no_hp', p.no_hp).strip() or '-'

    db.session.commit()
    return jsonify({'status': 'success', 'message': 'Data pegawai berhasil diperbarui', 'pegawai': p.to_dict()})

@app.route('/api/pegawai/delete', methods=['POST'])
def delete_pegawai():
    err = require_privileged(get_current_user())
    if err: return err

    data = request.json or {}
    p_id = data.get('id')
    if not p_id:
        return jsonify({'status': 'error', 'message': 'ID pegawai wajib diisi'}), 400

    p = db.session.get(Pegawai, int(p_id))
    if p:
        Jadwal.query.filter_by(pegawai_id=p_id).delete()
        User.query.filter_by(pegawai_id=p_id).delete()
        db.session.delete(p)
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Data pegawai berhasil dihapus'})

    return jsonify({'status': 'error', 'message': 'Pegawai tidak ditemukan'}), 404

# -------------------------------------------------------------

# JADWAL MUTATION API ENDPOINTS (PROTECTED)
# -------------------------------------------------------------
@app.route('/api/jadwal/update', methods=['POST'])
def update_jadwal():
    # Auth check DULU sebelum apapun
    err = require_privileged(get_current_user())
    if err: return err

    data = request.json or {}
    jadwal_id = data.get('jadwal_id')
    tanggal = data.get('tanggal')
    ruangan_id = data.get('ruangan_id')
    pegawai_id = data.get('pegawai_id')
    shift_id = data.get('shift_id')
    catatan = data.get('catatan', '')

    if not (tanggal and pegawai_id and shift_id):
        return jsonify({'status': 'error', 'message': 'Data tidak lengkap'}), 400

    shift_obj = db.session.get(Shift, shift_id) if shift_id else None
    if shift_obj and shift_obj.kode in SHIFT_OFF_CODES:
        ruangan_id = None
    elif not ruangan_id:
        return jsonify({'status': 'error', 'message': 'Ruangan harus dipilih untuk shift dinas'}), 400

    try:
        dt = datetime.strptime(tanggal, '%Y-%m-%d')
    except ValueError:
        return jsonify({'status': 'error', 'message': 'Format tanggal tidak valid'}), 400

    st_obj = get_or_create_status(dt.year, dt.month)
    if st_obj.status == STATUS.FINAL:
        return jsonify({'status': 'error', 'message': 'Jadwal bulan ini sudah FINAL & terkunci oleh Kepala Puskesmas!'}), 403

    # Cek konflik: pegawai sudah ditugaskan di hari yang sama
    existing_staff_assignment = Jadwal.query.filter_by(tanggal=tanggal, pegawai_id=pegawai_id).first()

    if jadwal_id:
        target_j = db.session.get(Jadwal, jadwal_id)
        if not target_j:
            return jsonify({'status': 'error', 'message': 'Jadwal tidak ditemukan'}), 404

        if existing_staff_assignment and existing_staff_assignment.id != target_j.id and ruangan_id is not None and existing_staff_assignment.ruangan_id is not None:
            return _build_conflict_error(existing_staff_assignment)

        target_j.ruangan_id = ruangan_id
        target_j.shift_id = shift_id
        target_j.catatan = catatan
    else:
        # Jika pegawai sudah memiliki penugasan pada tanggal tersebut:
        if existing_staff_assignment:
            # Konflik hanya terjadi jika pegawai sudah berdinas di RUANGAN LAIN pada tanggal yang sama
            if ruangan_id is not None and existing_staff_assignment.ruangan_id is not None and existing_staff_assignment.ruangan_id != ruangan_id:
                return _build_conflict_error(existing_staff_assignment)

            # Perbarui penugasan yang ada (termasuk mengganti status Libur/Cuti atau ruangan yang sama)
            existing_staff_assignment.ruangan_id = ruangan_id
            existing_staff_assignment.shift_id = shift_id
            existing_staff_assignment.catatan = catatan
        else:
            new_j = Jadwal(
                tanggal=tanggal,
                pegawai_id=pegawai_id,
                shift_id=shift_id,
                ruangan_id=ruangan_id,
                catatan=catatan
            )
            db.session.add(new_j)

    db.session.commit()
    return jsonify({'status': 'success', 'message': 'Jadwal berhasil diperbarui'})

@app.route('/api/jadwal/delete', methods=['POST'])
def delete_jadwal():
    err = require_privileged(get_current_user())
    if err: return err

    data = request.json or {}
    jadwal_id = data.get('jadwal_id')
    tanggal = data.get('tanggal')
    ruangan_id = data.get('ruangan_id')
    pegawai_id = data.get('pegawai_id')

    FINAL_MSG = 'Jadwal bulan ini sudah FINAL & terkunci oleh Kepala Puskesmas!'

    if jadwal_id:
        target = db.session.get(Jadwal, jadwal_id)
        if target:
            dt = datetime.strptime(target.tanggal, '%Y-%m-%d')
            if get_or_create_status(dt.year, dt.month).status == STATUS.FINAL:
                return jsonify({'status': 'error', 'message': FINAL_MSG}), 403
            db.session.delete(target)
            db.session.commit()
            return jsonify({'status': 'success', 'message': 'Jadwal berhasil dihapus'})

    elif tanggal and ruangan_id and pegawai_id:
        target = Jadwal.query.filter_by(tanggal=tanggal, ruangan_id=ruangan_id, pegawai_id=pegawai_id).first()
        if target:
            dt = datetime.strptime(tanggal, '%Y-%m-%d')
            if get_or_create_status(dt.year, dt.month).status == STATUS.FINAL:
                return jsonify({'status': 'error', 'message': FINAL_MSG}), 403
            db.session.delete(target)
            db.session.commit()
            return jsonify({'status': 'success', 'message': 'Jadwal berhasil dihapus'})

    elif tanggal and ruangan_id:
        dt = datetime.strptime(tanggal, '%Y-%m-%d')
        if get_or_create_status(dt.year, dt.month).status == STATUS.FINAL:
            return jsonify({'status': 'error', 'message': FINAL_MSG}), 403
        Jadwal.query.filter_by(tanggal=tanggal, ruangan_id=ruangan_id).delete()
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Semua penugasan di layanan ini pada tanggal tersebut berhasil dihapus'})

    return jsonify({'status': 'error', 'message': 'Data jadwal tidak ditemukan'}), 404

@app.route('/api/jadwal/bulk', methods=['POST'])
def bulk_jadwal():
    # Auth check DULU
    err = require_privileged(get_current_user())
    if err: return err

    data = request.json or {}
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    ruangan_id = data.get('ruangan_id')
    pegawai_id = data.get('pegawai_id')
    shift_id = data.get('shift_id')

    if not (start_date and end_date and pegawai_id and shift_id):
        return jsonify({'status': 'error', 'message': 'Parameter bulk mapping tidak lengkap'}), 400

    shift_obj = db.session.get(Shift, shift_id) if shift_id else None
    if shift_obj and shift_obj.kode in SHIFT_OFF_CODES:
        ruangan_id = None
    elif not ruangan_id:
        return jsonify({'status': 'error', 'message': 'Ruangan harus dipilih untuk shift dinas'}), 400

    try:
        d_start = datetime.strptime(start_date, '%Y-%m-%d')
        d_end = datetime.strptime(end_date, '%Y-%m-%d')
    except ValueError:
        return jsonify({'status': 'error', 'message': 'Format tanggal salah'}), 400

    if d_end < d_start:
        return jsonify({'status': 'error', 'message': 'Tanggal akhir tidak boleh sebelum tanggal awal'}), 400

    st_obj = get_or_create_status(d_start.year, d_start.month)
    if st_obj.status == STATUS.FINAL:
        return jsonify({'status': 'error', 'message': 'Jadwal bulan ini sudah FINAL & terkunci oleh Kepala Puskesmas!'}), 403

    peg = db.session.get(Pegawai, pegawai_id)
    peg_name = peg.nama if peg else 'Pegawai'

    conflicts_skipped = []
    applied_count = 0

    from datetime import timedelta
    curr = d_start
    while curr <= d_end:
        tgl_str = curr.strftime('%Y-%m-%d')

        existing_assignment = Jadwal.query.filter_by(tanggal=tgl_str, pegawai_id=pegawai_id).first()

        if existing_assignment and ruangan_id is not None and existing_assignment.ruangan_id != ruangan_id and existing_assignment.ruangan_id is not None:
            conflicts_skipped.append(tgl_str)
        else:
            if existing_assignment:
                existing_assignment.shift_id = shift_id
                existing_assignment.ruangan_id = ruangan_id
            else:
                new_j = Jadwal(
                    tanggal=tgl_str,
                    pegawai_id=pegawai_id,
                    shift_id=shift_id,
                    ruangan_id=ruangan_id
                )
                db.session.add(new_j)
            applied_count += 1

        curr += timedelta(days=1)

    db.session.commit()

    if conflicts_skipped:
        return jsonify({
            'status': 'warning',
            'message': f'Bulk mapping diterapkan untuk {applied_count} tanggal. {len(conflicts_skipped)} tanggal dilewati karena {peg_name} sudah bertugas di layanan lain.'
        })

    return jsonify({'status': 'success', 'message': f'Bulk mapping berhasil diterapkan untuk {applied_count} tanggal!'})

# -------------------------------------------------------------
# APPROVAL WORKFLOW ENDPOINT
# -------------------------------------------------------------
@app.route('/api/jadwal/status/update', methods=['POST'])
def update_status_jadwal():
    curr_u = get_current_user()
    if not curr_u:
        return jsonify({'status': 'error', 'message': 'Anda harus login untuk mengubah status jadwal'}), 401

    data = request.json or {}
    try:
        year  = int(data.get('year',  datetime.now().year))
        month = int(data.get('month', datetime.now().month))
    except (ValueError, TypeError):
        return jsonify({'status': 'error', 'message': 'Tahun/bulan tidak valid'}), 400

    action = data.get('action')
    st_obj = get_or_create_status(year, month)

    if action == 'submit':
        # Hanya admin yang boleh mengajukan
        if curr_u.role != ROLES.ADMIN:
            return jsonify({'status': 'error', 'message': 'Hanya Admin yang dapat mengajukan jadwal ke Kepala Puskesmas!'}), 403
        st_obj.status = STATUS.SUBMITTED
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Jadwal berhasil diajukan ke Kepala Puskesmas!'})

    elif action == 'approve':
        if curr_u.role != ROLES.KAPUS:
            return jsonify({'status': 'error', 'message': 'Hanya Kepala Puskesmas yang dapat menyetujui jadwal!'}), 403
        st_obj.status = STATUS.FINAL
        st_obj.approved_by = curr_u.to_dict().get('pegawai_nama', curr_u.username)
        st_obj.approved_at = datetime.now().strftime('%Y-%m-%d %H:%M')
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Jadwal telah DISETUJUI & DIFINALKAN oleh Kepala Puskesmas!'})

    elif action == 'revert':
        if curr_u.role != ROLES.KAPUS:
            return jsonify({'status': 'error', 'message': 'Hanya Kepala Puskesmas yang dapat mengembalikan jadwal ke Draft!'}), 403
        st_obj.status = STATUS.DRAFT
        st_obj.approved_by = None
        st_obj.approved_at = None
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Jadwal dikembalikan ke status DRAFT untuk revisi.'})

    return jsonify({'status': 'error', 'message': 'Aksi tidak valid'}), 400

@app.route('/api/export/excel', methods=['GET'])
def export_excel():
    year = int(request.args.get('year', datetime.now().year))
    month = int(request.args.get('month', datetime.now().month))
    
    excel_stream = generate_excel_schedule(year, month)
    filename = f"Jadwal_SDMK_Puskesmas_{year}_{month:02d}.xlsx"

    return send_file(
        excel_stream,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=filename
    )

# -------------------------------------------------------------
# EXCEL DATA IMPORT & TEMPLATE API ENDPOINTS
# -------------------------------------------------------------
@app.route('/api/template/excel', methods=['GET'])
def download_template_excel():
    template_path = os.path.join(app.root_path, "template_sdmk_puskesmas.xlsx")
    if not os.path.exists(template_path):
        generate_excel_template(template_path)

    return send_file(
        template_path,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name="template_sdmk_puskesmas.xlsx"
    )

@app.route('/api/import/excel', methods=['POST'])
def import_excel_data():
    err = require_privileged(get_current_user())
    if err: return err

    if 'file' not in request.files:
        return jsonify({'status': 'error', 'message': 'Berkas Excel tidak ditemukan'}), 400

    file = request.files['file']
    if not file or file.filename == '':
        return jsonify({'status': 'error', 'message': 'File belum dipilih'}), 400

    if not file.filename.lower().endswith(('.xlsx', '.xls')):
        return jsonify({'status': 'error', 'message': 'Format file harus .xlsx atau .xls'}), 400

    temp_path = None
    try:
        # Gunakan NamedTemporaryFile untuk menghindari race condition
        suffix = '.xlsx' if file.filename.lower().endswith('.xlsx') else '.xls'
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            temp_path = tmp.name
            file.save(temp_path)

        reset_jadwal = request.form.get('reset_jadwal', 'true').lower() == 'true'
        result = parse_and_import_excel(temp_path, reset_jadwal=reset_jadwal)

        return jsonify({
            'status': 'success',
            'message': f"Berhasil mengimpor {result['pegawai_imported']} data pegawai dan {result['ruangan_imported']} unit layanan real!",
            'data': result
        })
    except ValueError as e:
        # Error yang dapat diprediksi (format file salah, kolom tidak ditemukan, dll)
        return jsonify({'status': 'error', 'message': f"Format file tidak valid: {str(e)}"}), 400
    except Exception:
        # Sembunyikan detail internal error dari client
        app.logger.exception("Import Excel gagal")
        return jsonify({'status': 'error', 'message': 'Gagal mengimpor file. Pastikan format file sesuai template.'}), 500
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

@app.route('/api/admin/backup-db', methods=['GET'])
def backup_db():
    """Endpoint khusus Admin/Kapus untuk mengunduh berkas database SQLite (.db)."""
    curr_user = get_current_user()
    err = require_privileged(curr_user)
    if err:
        return err

    if not os.path.exists(db_path):
        return jsonify({'status': 'error', 'message': 'File database SQLite tidak ditemukan pada server.'}), 404

    now_str = datetime.now().strftime('%Y%m%d_%H%M%S')
    download_name = f'backup_puskesmas_sdmk_{now_str}.db'
    return send_file(
        db_path,
        as_attachment=True,
        download_name=download_name,
        mimetype='application/x-sqlite3'
    )

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    # debug hanya aktif jika env var DEBUG=true
    debug_mode = os.environ.get('DEBUG', 'false').lower() == 'true'
    app.run(host='0.0.0.0', port=5050, debug=debug_mode)

