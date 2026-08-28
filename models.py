from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='pegawai') # 'admin', 'kapus', 'pegawai'
    pegawai_id = db.Column(db.Integer, db.ForeignKey('pegawai.id'), nullable=True)

    pegawai = db.relationship('Pegawai', backref=db.backref('user_account', uselist=False))

    def __init__(self, username, role='pegawai', pegawai_id=None, password_hash=None):
        self.username = username
        self.role = role
        self.pegawai_id = pegawai_id
        if password_hash:
            self.password_hash = password_hash

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'role': self.role,
            'pegawai_id': self.pegawai_id,
            'pegawai_nama': self.pegawai.nama if self.pegawai else (
                'Kepala Puskesmas' if self.role == 'kapus' else 'Admin SDMK'
            )
        }

class StatusJadwal(db.Model):
    __tablename__ = 'status_jadwal'
    id = db.Column(db.Integer, primary_key=True)
    tahun = db.Column(db.Integer, nullable=False)
    bulan = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(20), nullable=False, default='DRAFT') # 'DRAFT', 'SUBMITTED', 'FINAL'
    approved_by = db.Column(db.String(100), nullable=True)
    approved_at = db.Column(db.String(50), nullable=True)

    def __init__(self, tahun, bulan, status='DRAFT', approved_by=None, approved_at=None):
        self.tahun = tahun
        self.bulan = bulan
        self.status = status
        self.approved_by = approved_by
        self.approved_at = approved_at

    def to_dict(self):
        return {
            'id': self.id,
            'tahun': self.tahun,
            'bulan': self.bulan,
            'status': self.status,
            'approved_by': self.approved_by or '',
            'approved_at': self.approved_at or ''
        }

class Pegawai(db.Model):
    __tablename__ = 'pegawai'
    id = db.Column(db.Integer, primary_key=True)
    nip = db.Column(db.String(50), nullable=True)
    nama = db.Column(db.String(100), nullable=False)
    profesi = db.Column(db.String(50), nullable=False)
    no_hp = db.Column(db.String(20), nullable=True)

    def __init__(self, nama, profesi, nip=None, no_hp=None):
        self.nama = nama
        self.profesi = profesi
        self.nip = nip
        self.no_hp = no_hp

    def to_dict(self):
        return {
            'id': self.id,
            'nip': self.nip or '-',
            'nama': self.nama,
            'profesi': self.profesi,
            'no_hp': self.no_hp or '-'
        }

class Ruangan(db.Model):
    __tablename__ = 'ruangan'
    id = db.Column(db.Integer, primary_key=True)
    nama = db.Column(db.String(100), nullable=False)
    kode = db.Column(db.String(20), nullable=True)
    klaster = db.Column(db.String(50), nullable=False)
    urutan = db.Column(db.Integer, default=0)

    def __init__(self, nama, klaster, kode=None, urutan=0):
        self.nama = nama
        self.klaster = klaster
        self.kode = kode
        self.urutan = urutan

    def to_dict(self):
        return {
            'id': self.id,
            'nama': self.nama,
            'kode': self.kode or '',
            'klaster': self.klaster,
            'urutan': self.urutan
        }

class Shift(db.Model):
    __tablename__ = 'shift'
    id = db.Column(db.Integer, primary_key=True)
    kode = db.Column(db.String(10), nullable=False, unique=True)
    nama = db.Column(db.String(50), nullable=False)
    jam_masuk = db.Column(db.String(20), nullable=True)
    jam_keluar = db.Column(db.String(20), nullable=True)
    warna_bg = db.Column(db.String(20), nullable=False, default='#0d9488')
    warna_text = db.Column(db.String(20), nullable=False, default='#ffffff')

    def __init__(self, kode, nama, warna_bg='#0d9488', warna_text='#ffffff', jam_masuk=None, jam_keluar=None):
        self.kode = kode
        self.nama = nama
        self.warna_bg = warna_bg
        self.warna_text = warna_text
        self.jam_masuk = jam_masuk
        self.jam_keluar = jam_keluar

    def to_dict(self):
        return {
            'id': self.id,
            'kode': self.kode,
            'nama': self.nama,
            'jam_masuk': self.jam_masuk or '',
            'jam_keluar': self.jam_keluar or '',
            'warna_bg': self.warna_bg,
            'warna_text': self.warna_text
        }

class Jadwal(db.Model):
    __tablename__ = 'jadwal'
    id = db.Column(db.Integer, primary_key=True)
    tanggal = db.Column(db.String(10), nullable=False)
    pegawai_id = db.Column(db.Integer, db.ForeignKey('pegawai.id'), nullable=False)
    ruangan_id = db.Column(db.Integer, db.ForeignKey('ruangan.id'), nullable=False)
    shift_id = db.Column(db.Integer, db.ForeignKey('shift.id'), nullable=False)
    catatan = db.Column(db.Text, nullable=True)

    pegawai = db.relationship('Pegawai', backref=db.backref('jadwal_list', lazy=True))
    ruangan = db.relationship('Ruangan', backref=db.backref('jadwal_list', lazy=True))
    shift = db.relationship('Shift', backref=db.backref('jadwal_list', lazy=True))

    def __init__(self, tanggal, pegawai_id, ruangan_id, shift_id, catatan=''):
        self.tanggal = tanggal
        self.pegawai_id = pegawai_id
        self.ruangan_id = ruangan_id
        self.shift_id = shift_id
        self.catatan = catatan

    def to_dict(self):
        return {
            'id': self.id,
            'tanggal': self.tanggal,
            'pegawai_id': self.pegawai_id,
            'pegawai_nama': self.pegawai.nama if self.pegawai else '',
            'pegawai_profesi': self.pegawai.profesi if self.pegawai else '',
            'ruangan_id': self.ruangan_id,
            'ruangan_nama': self.ruangan.nama if self.ruangan else '',
            'klaster': self.ruangan.klaster if self.ruangan else '',
            'shift_id': self.shift_id,
            'shift_kode': self.shift.kode if self.shift else '',
            'shift_nama': self.shift.nama if self.shift else '',
            'warna_bg': self.shift.warna_bg if self.shift else '#475569',
            'warna_text': self.shift.warna_text if self.shift else '#ffffff',
            'catatan': self.catatan or ''
        }
