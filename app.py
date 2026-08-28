import os
import calendar
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file, session
from models import db, Pegawai, Ruangan, Shift, Jadwal, User, StatusJadwal
from excel_exporter import generate_excel_schedule, INDONESIAN_MONTHS

app = Flask(__name__)
app.config['SECRET_KEY'] = 'puskesmas-sdmk-secret-key-2026'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///puskesmas_sdmk.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

def get_current_user():
    user_id = session.get('user_id')
    if user_id:
        u = User.query.get(user_id)
        if u:
            return u
    return None

def get_or_create_status(year, month):
    st = StatusJadwal.query.filter_by(tahun=year, bulan=month).first()
    if not st:
        st = StatusJadwal(tahun=year, bulan=month, status='DRAFT')
        db.session.add(st)
        db.session.commit()
    return st

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
    
    jadwals = Jadwal.query.filter(Jadwal.tanggal >= start_str, Jadwal.tanggal <= end_str).all()
    jadwal_list = [j.to_dict() for j in jadwals]

    # Detect conflicts
    assignments = {}
    for j in jadwals:
        if j.shift and j.shift.kode not in ['L', 'C']:
            key = (j.pegawai_id, j.tanggal)
            if key not in assignments:
                assignments[key] = []
            assignments[key].append({
                'ruangan_nama': j.ruangan.nama if j.ruangan else '',
                'shift_kode': j.shift.kode
            })

    conflicts = []
    for (peg_id, tgl), room_shifts in assignments.items():
        if len(room_shifts) > 1:
            peg = next((p for p in pegawai_list if p['id'] == peg_id), None)
            conflicts.append({
                'tanggal': tgl,
                'pegawai_nama': peg['nama'] if peg else '',
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
    curr_user = get_current_user()
    if curr_user and curr_user.role == 'pegawai':
        return jsonify({'status': 'error', 'message': 'Hanya Admin/PJ yang dapat menambah layanan'}), 403

    data = request.json or {}
    nama = data.get('nama', '').strip()
    kode = data.get('kode', '').strip()
    klaster = data.get('klaster', 'Klaster 1 (Manajemen)').strip()
    urutan = int(data.get('urutan', 99))

    if not nama:
        return jsonify({'status': 'error', 'message': 'Nama layanan wajib diisi'}), 400

    new_r = Ruangan(nama=nama, kode=kode, klaster=klaster, urutan=urutan)
    db.session.add(new_r)
    db.session.commit()

    return jsonify({'status': 'success', 'message': 'Layanan baru berhasil ditambahkan', 'ruangan': new_r.to_dict()})

@app.route('/api/ruangan/delete', methods=['POST'])
def delete_ruangan():
    curr_user = get_current_user()
    if curr_user and curr_user.role == 'pegawai':
        return jsonify({'status': 'error', 'message': 'Akses ditolak'}), 403

    data = request.json or {}
    r_id = data.get('id')
    
    r = Ruangan.query.get(r_id)
    if r:
        Jadwal.query.filter_by(ruangan_id=r_id).delete()
        db.session.delete(r)
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Layanan berhasil dihapus'})

    return jsonify({'status': 'error', 'message': 'Layanan tidak ditemukan'}), 404

# -------------------------------------------------------------
# JADWAL MUTATION API ENDPOINTS (PROTECTED)
# -------------------------------------------------------------
@app.route('/api/jadwal/update', methods=['POST'])
def update_jadwal():
    data = request.json or {}
    tanggal = data.get('tanggal')
    ruangan_id = data.get('ruangan_id')
    pegawai_id = data.get('pegawai_id')
    shift_id = data.get('shift_id')
    catatan = data.get('catatan', '')

    if not (tanggal and ruangan_id and pegawai_id and shift_id):
        return jsonify({'status': 'error', 'message': 'Data tidak lengkap'}), 400

    dt = datetime.strptime(tanggal, '%Y-%m-%d')
    st_obj = get_or_create_status(dt.year, dt.month)
    
    if st_obj.status == 'FINAL':
        return jsonify({'status': 'error', 'message': 'Jadwal bulan ini sudah FINAL & terkunci oleh Kepala Puskesmas!'}), 403

    curr_user = get_current_user()
    if curr_user and curr_user.role == 'pegawai':
        return jsonify({'status': 'error', 'message': 'Pegawai biasa tidak memiliki akses mengubah jadwal!'}), 403

    existing = Jadwal.query.filter_by(tanggal=tanggal, ruangan_id=ruangan_id).first()
    if existing:
        existing.pegawai_id = pegawai_id
        existing.shift_id = shift_id
        existing.catatan = catatan
    else:
        new_j = Jadwal(
            tanggal=tanggal,
            ruangan_id=ruangan_id,
            pegawai_id=pegawai_id,
            shift_id=shift_id,
            catatan=catatan
        )
        db.session.add(new_j)

    db.session.commit()
    return jsonify({'status': 'success', 'message': 'Jadwal berhasil diperbarui'})

@app.route('/api/jadwal/delete', methods=['POST'])
def delete_jadwal():
    data = request.json or {}
    tanggal = data.get('tanggal')
    ruangan_id = data.get('ruangan_id')

    if not (tanggal and ruangan_id):
        return jsonify({'status': 'error', 'message': 'Data tidak lengkap'}), 400

    dt = datetime.strptime(tanggal, '%Y-%m-%d')
    st_obj = get_or_create_status(dt.year, dt.month)
    
    if st_obj.status == 'FINAL':
        return jsonify({'status': 'error', 'message': 'Jadwal bulan ini sudah FINAL & terkunci oleh Kepala Puskesmas!'}), 403

    curr_user = get_current_user()
    if curr_user and curr_user.role == 'pegawai':
        return jsonify({'status': 'error', 'message': 'Pegawai biasa tidak memiliki akses menghapus jadwal!'}), 403

    existing = Jadwal.query.filter_by(tanggal=tanggal, ruangan_id=ruangan_id).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()

    return jsonify({'status': 'success', 'message': 'Jadwal berhasil dihapus'})

@app.route('/api/jadwal/bulk', methods=['POST'])
def bulk_jadwal():
    data = request.json or {}
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    ruangan_id = data.get('ruangan_id')
    pegawai_id = data.get('pegawai_id')
    shift_id = data.get('shift_id')

    if not (start_date and end_date and ruangan_id and pegawai_id and shift_id):
        return jsonify({'status': 'error', 'message': 'Parameter bulk mapping tidak lengkap'}), 400

    try:
        d_start = datetime.strptime(start_date, '%Y-%m-%d')
        d_end = datetime.strptime(end_date, '%Y-%m-%d')
    except ValueError:
        return jsonify({'status': 'error', 'message': 'Format tanggal salah'}), 400

    st_obj = get_or_create_status(d_start.year, d_start.month)
    if st_obj.status == 'FINAL':
        return jsonify({'status': 'error', 'message': 'Jadwal bulan ini sudah FINAL & terkunci oleh Kepala Puskesmas!'}), 403

    curr_user = get_current_user()
    if curr_user and curr_user.role == 'pegawai':
        return jsonify({'status': 'error', 'message': 'Pegawai biasa tidak memiliki akses bulk mapping!'}), 403

    curr = d_start
    while curr <= d_end:
        tgl_str = curr.strftime('%Y-%m-%d')
        existing = Jadwal.query.filter_by(tanggal=tgl_str, ruangan_id=ruangan_id).first()
        if existing:
            existing.pegawai_id = pegawai_id
            existing.shift_id = shift_id
        else:
            new_j = Jadwal(
                tanggal=tgl_str,
                ruangan_id=ruangan_id,
                pegawai_id=pegawai_id,
                shift_id=shift_id
            )
            db.session.add(new_j)
        curr = datetime.fromordinal(curr.toordinal() + 1)

    db.session.commit()
    return jsonify({'status': 'success', 'message': 'Bulk mapping jadwal berhasil diterapkan'})

# -------------------------------------------------------------
# APPROVAL WORKFLOW ENDPOINT
# -------------------------------------------------------------
@app.route('/api/jadwal/status/update', methods=['POST'])
def update_status_jadwal():
    data = request.json or {}
    year = int(data.get('year', datetime.now().year))
    month = int(data.get('month', datetime.now().month))
    action = data.get('action')

    st_obj = get_or_create_status(year, month)
    curr_u = get_current_user()

    if action == 'submit':
        st_obj.status = 'SUBMITTED'
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Jadwal berhasil diajukan ke Kepala Puskesmas!'})

    elif action == 'approve':
        if curr_u and curr_u.role != 'kapus':
            return jsonify({'status': 'error', 'message': 'Hanya Kepala Puskesmas yang dapat menyetujui jadwal!'}), 403

        st_obj.status = 'FINAL'
        st_obj.approved_by = curr_u.pegawai_nama if curr_u else 'dr. H. Rahmad, M.Kes (Kepala Puskesmas)'
        st_obj.approved_at = datetime.now().strftime('%Y-%m-%d %H:%M')
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Jadwal telah DISETUJUI & DIFINALKAN oleh Kepala Puskesmas!'})

    elif action == 'revert':
        st_obj.status = 'DRAFT'
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

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=5050, debug=True)
