import sys
import os
import calendar
import random
from datetime import datetime, timedelta
from app import app
from models import db, Pegawai, Ruangan, Shift, Jadwal, User, StatusJadwal
from import_excel import parse_and_import_excel, generate_excel_template

def clear_all_data():
    with app.app_context():
        print("--> Clearing Database tables...")
        Jadwal.query.delete()
        User.query.delete()
        Pegawai.query.delete()
        Ruangan.query.delete()
        Shift.query.delete()
        StatusJadwal.query.delete()
        db.session.commit()
        print("--> Database cleared successfully!")

def init_seed_data(excel_path=None):
    with app.app_context():
        db.create_all()

        if excel_path and os.path.exists(excel_path):
            print(f"--> Importing Master Data from Excel: {excel_path} ...")
            # Ensure Shift data exists
            if Shift.query.count() == 0:
                init_master_shifts()
            res = parse_and_import_excel(excel_path, reset_jadwal=True)
            print(f"--> Success! {res['pegawai_imported']} Pegawai & {res['ruangan_imported']} Ruangan imported.")
            init_default_users()
            return

        print("--> Seeding Master Shift...")
        init_master_shifts()

        print("--> Seeding Ruangan & Layanan (ILP Puskesmas Standard)...")
        ruangan_data = [
            {'nama': 'Pendaftaran & Rekam Medis', 'kode': 'RM', 'klaster': 'Klaster 1 (Manajemen)', 'urutan': 1},
            {'nama': 'Tata Usaha / Kasir', 'kode': 'TU', 'klaster': 'Klaster 1 (Manajemen)', 'urutan': 2},
            {'nama': 'Poli KIA & KB', 'kode': 'KIA', 'klaster': 'Klaster 2 (Ibu & Anak)', 'urutan': 3},
            {'nama': 'Poli Anak & Imunisasi', 'kode': 'IMN', 'klaster': 'Klaster 2 (Ibu & Anak)', 'urutan': 4},
            {'nama': 'Poli Umum', 'kode': 'UMM', 'klaster': 'Klaster 3 (Dewasa & Lansia)', 'urutan': 5},
            {'nama': 'Poli Gigi & Mulut', 'kode': 'GGI', 'klaster': 'Klaster 3 (Dewasa & Lansia)', 'urutan': 6},
            {'nama': 'Poli Lansia & PTM', 'kode': 'PTM', 'klaster': 'Klaster 3 (Dewasa & Lansia)', 'urutan': 7},
            {'nama': 'Farmasi / Apotek', 'kode': 'APT', 'klaster': 'Klaster 4 (P2)', 'urutan': 8},
            {'nama': 'Laboratorium', 'kode': 'LAB', 'klaster': 'Klaster 4 (P2)', 'urutan': 9},
            {'nama': 'Ruang Gizi & Kesling', 'kode': 'GZI', 'klaster': 'Klaster 4 (P2)', 'urutan': 10},
            {'nama': 'IGD / Gawat Darurat (24 Jam)', 'kode': 'IGD', 'klaster': 'Klaster 5 (Lintas Klaster)', 'urutan': 11},
            {'nama': 'Ruang Rawat Inap', 'kode': 'RNI', 'klaster': 'Klaster 5 (Lintas Klaster)', 'urutan': 12},
            {'nama': 'Pustu Desa Sukamaju', 'kode': 'PST1', 'klaster': 'Luar Induk', 'urutan': 13},
            {'nama': 'Poskesdes Harapan', 'kode': 'POS1', 'klaster': 'Luar Induk', 'urutan': 14},
            {'nama': 'Puskesmas Keliling (Pusling)', 'kode': 'PSL', 'klaster': 'Luar Induk', 'urutan': 15}
        ]

        ruangan_objs = []
        for r in ruangan_data:
            existing_r = Ruangan.query.filter_by(nama=r['nama']).first()
            if not existing_r:
                ruang = Ruangan(**r)
                db.session.add(ruang)
                db.session.flush()
                ruangan_objs.append(ruang)
            else:
                ruangan_objs.append(existing_r)

        print("--> Seeding Pegawai SDMK...")
        pegawai_data = [
            {'nip': '19750423 200212 2 005', 'nama': 'dr.Durotun Nafisa', 'profesi': 'Dokter Umum', 'no_hp': '-' },
            {'nip': '19810604 200902 2 004', 'nama': 'drg. Putri Emyta Sari', 'profesi': 'Dokter Gigi', 'no_hp': '-' },
            {'nip': '19700508 199203 1 003', 'nama': 'Setya Budi, Amd., Kep', 'profesi': 'Perawat', 'no_hp': '-' },
            {'nip': '19691030 199203 2 008', 'nama': 'Luluk Listyaningsih,AMG', 'profesi': 'Nutrisionis', 'no_hp': '-' },
            {'nip': '19710125 199203 2 010', 'nama': 'Yuanendah, SST.', 'profesi': 'Bidan', 'no_hp': '-' },
            {'nip': '19810704 200901 1 004', 'nama': 'Daril Rahmatullah, S. Farm.', 'profesi': 'Apoteker', 'no_hp': '-' },
            {'nip': '19780908 199903 2 001', 'nama': 'Fitri Ariani Isnaningtyas, Amd.AK', 'profesi': 'Pranata Laboratorium', 'no_hp': '-' },
            {'nip': '19871127 201001 2 008', 'nama': 'Rinda Ari Puspita, Amd. KG', 'profesi': 'Terapis Gigi', 'no_hp': '-' },
            {'nip': '19960310 202203 1 005', 'nama': 'dr. Rizky Rachmat Kurniawan', 'profesi': 'Dokter Umum', 'no_hp': '-' },
            {'nip': '19720306 200604 2 014', 'nama': 'Supatemi, Amd.Keb', 'profesi': 'Bidan', 'no_hp': '-' },
            {'nip': '19740806 200604 2 022', 'nama': 'Anik Sri Purwati, Amd. Keb.', 'profesi': 'Bidan', 'no_hp': '-' },
            {'nip': '19741101 200604 2 014', 'nama': 'Enny Nurhayati, Amd.. Keb.', 'profesi': 'Bidan', 'no_hp': '-' },
            {'nip': '19750315 200604 2 031', 'nama': 'Sulisni, Amd. Keb.', 'profesi': 'Bidan', 'no_hp': '-' },
            {'nip': '19751117 200701 2 010', 'nama': 'Estu Rahayuningsih, Amd. Keb.', 'profesi': 'Bidan', 'no_hp': '-' },
            {'nip': '19760521 200701 2 012', 'nama': 'Prihatiningtyas, Amd. Keb.', 'profesi': 'Bidan', 'no_hp': '-' },
            {'nip': '19870507 201402 2 001', 'nama': 'Mey Idayati, Amd.Kep', 'profesi': 'Perawat', 'no_hp': '-' },
            {'nip': '19790506 201001 1 027', 'nama': 'Sito Luncono Setio Utomo', 'profesi': 'Staf TU', 'no_hp': '-' },
            {'nip': '19870803 201903 2 005', 'nama': 'Siti Aminah, Amd Kep.', 'profesi': 'Perawat', 'no_hp': '-' },
            {'nip': '19970326 202012 2 013', 'nama': 'Nuryana Vidya C, Amd.Kep', 'profesi': 'Perawat', 'no_hp': '-' },
            {'nip': '19951125 202012 2 013', 'nama': 'Novia Anjarwati, Amd. Kes', 'profesi': 'Sanitarian', 'no_hp': '-' },
            {'nip': '19930105 202221 2 001', 'nama': 'Dinung Wahyu Purwanti', 'profesi': 'Bidan', 'no_hp': '-' },
            {'nip': '19940405 202321 2 005', 'nama': 'Susi Winda Wandari, Amd Keb', 'profesi': 'Bidan', 'no_hp': '-' },
            {'nip': '3506216412890001', 'nama': 'Desi Natalia, SST', 'profesi': 'Bidan', 'no_hp': '-' },
            {'nip': '3506164503950002', 'nama': 'Devi Ardianti, SE', 'profesi': 'Staf TU', 'no_hp': '-' },
            {'nip': '3506214506950001', 'nama': 'Vivi Juni Mega A, S.Tr.Keb', 'profesi': 'Bidan', 'no_hp': '-' },
            {'nip': '3506215706900001', 'nama': 'Anieta Yuni Purnawati, Amd.Keb', 'profesi': 'Bidan', 'no_hp': '-' },
            {'nip': '3506212005790003', 'nama': 'Slamet Riadi', 'profesi': 'Staf TU', 'no_hp': '-' },
            {'nip': '3506214101850002', 'nama': 'Anita Sumariati', 'profesi': 'Petugas Kebersihan', 'no_hp': '-' },
            {'nip': '3506215707790002', 'nama': 'Mimin Asmawati', 'profesi': 'Petugas Kebersihan', 'no_hp': '-' },
            {'nip': '3506215502970001', 'nama': 'Fitria Indriyani', 'profesi': 'Staf TU', 'no_hp': '-' },
            {'nip': '3506154409920001', 'nama': 'Cendy Santia KS, Amd AK', 'profesi': 'Pranata Laboratorium', 'no_hp': '-' },
            {'nip': '3506266204980003', 'nama': 'Mistiani Saputri, Amd Kom', 'profesi': 'Staf TU', 'no_hp': '-' },
            {'nip': '3506265409920003', 'nama': 'Rani Rosita , Amd Keb', 'profesi': 'Bidan', 'no_hp': '-' },
            {'nip': '3506164105000001', 'nama': "Rise Nisa' Meiula Naaifah", 'profesi': 'Perekam Medis', 'no_hp': '-' },
            {'nip': '3506161109000001', 'nama': 'Shalikul Hadi, SKM', 'profesi': 'Promkes', 'no_hp': '-' },
            {'nip': '19871201 202421 1 018', 'nama': 'MUSTAINUL HABIBI', 'profesi': 'Perekam Medis', 'no_hp': '-' },
            {'nip': '19930220 202421 1 005', 'nama': 'GALIH CATUR AJI SETIAWAN', 'profesi': 'Dokter Umum', 'no_hp': '-' },
            {'nip': '19970129 202421 2 022', 'nama': 'BINTI KHOTIMATUL MUNAWAROH', 'profesi': 'Bidan', 'no_hp': '-' },
            {'nip': '199906292024212023', 'nama': 'VIRDA NILAYANTI', 'profesi': 'Perawat', 'no_hp': '-' },
            {'nip': '19950224 202421 2 013', 'nama': 'DELLA ANANDANI HAREFA', 'profesi': 'Perawat', 'no_hp': '-' },
            {'nip': '19970225 202521 2 007', 'nama': 'FENIA ELDIANA', 'profesi': 'Pranata Laboratorium', 'no_hp': '-' },
            {'nip': '3518071503890005', 'nama': 'Aide Bagus Lutfi Zakaria,A.Md.Kep', 'profesi': 'Perawat', 'no_hp': '-' },
            {'nip': '3506114111970003', 'nama': 'Wenly Novi Newanda,A.Md.Keb', 'profesi': 'Bidan', 'no_hp': '-' },
            {'nip': '3506216909940001', 'nama': 'Dwi Lestari,A.Md.Keb', 'profesi': 'Bidan', 'no_hp': '-' },
            {'nip': '19910519 202521 2 033', 'nama': 'ika Bintari,  A.Md.Keb', 'profesi': 'Bidan', 'no_hp': '-' },
            {'nip': '3506210301020001', 'nama': 'Ronal Ardianto', 'profesi': 'Petugas Kebersihan', 'no_hp': '-' },
            {'nip': '3506216208960001', 'nama': 'Rinda Agustina,Amd.Gizi', 'profesi': 'Nutrisionis', 'no_hp': '-' },
            {'nip': '3506210306030002', 'nama': 'Yogi Satrio Lelono', 'profesi': 'Perawat', 'no_hp': '-' },
        ]

        pegawai_objs = []
        for p in pegawai_data:
            existing_p = Pegawai.query.filter_by(nama=p['nama']).first()
            if not existing_p:
                peg = Pegawai(**p)
                db.session.add(peg)
                db.session.flush()
                pegawai_objs.append(peg)
            else:
                pegawai_objs.append(existing_p)

        print("--> Seeding User Accounts (Roles: admin, kapus, pegawai)...")
        init_default_users()

        print("--> Seeding Status Jadwal (August 2026 -> DRAFT)...")
        st_aug = StatusJadwal.query.filter_by(tahun=2026, bulan=8).first()
        if not st_aug:
            st_aug = StatusJadwal(tahun=2026, bulan=8, status='DRAFT')
            db.session.add(st_aug)

        print("--> Generating Sample Schedule for August 2026...")
        generate_sample_schedule(2026, 8, pegawai_objs, ruangan_objs)

        db.session.commit()
        print("--> Database Seeding Complete successfully!")

def init_master_shifts():
    shifts_data = [
        {'kode': 'P', 'nama': 'Pagi', 'jam_masuk': '07:30', 'jam_keluar': '14:00', 'warna_bg': '#0d9488', 'warna_text': '#ffffff'},   # Teal
        {'kode': 'S', 'nama': 'Siang', 'jam_masuk': '14:00', 'jam_keluar': '21:00', 'warna_bg': '#d97706', 'warna_text': '#ffffff'},  # Amber
        {'kode': 'M', 'nama': 'Malam', 'jam_masuk': '21:00', 'jam_keluar': '07:30', 'warna_bg': '#7c3aed', 'warna_text': '#ffffff'},  # Violet
        {'kode': 'ON', 'nama': 'On Call', 'jam_masuk': '24 Jam', 'jam_keluar': 'Standby', 'warna_bg': '#0284c7', 'warna_text': '#ffffff'}, # Light Blue
        {'kode': 'L', 'nama': 'Libur', 'jam_masuk': '-', 'jam_keluar': '-', 'warna_bg': '#334155', 'warna_text': '#94a3b8'},        # Slate Dark
        {'kode': 'C', 'nama': 'Cuti', 'jam_masuk': '-', 'jam_keluar': '-', 'warna_bg': '#e11d48', 'warna_text': '#ffffff'}          # Rose/Red
    ]
    for s in shifts_data:
        existing = Shift.query.filter_by(kode=s['kode']).first()
        if not existing:
            shift = Shift(**s)
            db.session.add(shift)
    db.session.commit()

def init_default_users():
    if User.query.filter_by(username='admin').count() == 0:
        u_admin = User(username='admin', role='admin')
        u_admin.set_password('admin123')
        db.session.add(u_admin)

    if User.query.filter_by(username='kapus').count() == 0:
        u_kapus = User(username='kapus', role='kapus')
        u_kapus.set_password('kapus123')
        db.session.add(u_kapus)

    db.session.commit()

def generate_sample_schedule(year, month, pegawai_objs, ruangan_objs):
    shift_objs = {s.kode: s for s in Shift.query.all()}
    start_date = datetime(year, month, 1)
    last_day = calendar.monthrange(year, month)[1]  # support semua bulan
    end_date = datetime(year, month, last_day)

    current = start_date
    while current <= end_date:
        date_str = current.strftime('%Y-%m-%d')
        day_of_week = current.weekday()
        assigned_today = set()

        for r in ruangan_objs:
            candidate_staff = []
            if 'KIA' in r.nama or 'Anak' in r.nama:
                candidate_staff = [p for p in pegawai_objs if p.profesi in ['Bidan', 'Dokter Umum']]
            elif 'Gigi' in r.nama:
                candidate_staff = [p for p in pegawai_objs if p.profesi == 'Dokter Gigi']
            elif 'Umum' in r.nama or 'Lansia' in r.nama:
                candidate_staff = [p for p in pegawai_objs if p.profesi in ['Dokter Umum', 'Perawat']]
            elif 'Farmasi' in r.nama:
                candidate_staff = [p for p in pegawai_objs if p.profesi in ['Apoteker', 'Asisten Apoteker']]
            elif 'Laboratorium' in r.nama:
                candidate_staff = [p for p in pegawai_objs if p.profesi == 'Pranata Laboratorium']
            elif 'Gizi' in r.nama:
                candidate_staff = [p for p in pegawai_objs if p.profesi in ['Nutrisionis', 'Sanitarian']]
            elif 'IGD' in r.nama or 'Rawat Inap' in r.nama:
                candidate_staff = [p for p in pegawai_objs if p.profesi in ['Dokter Umum', 'Perawat']]
            elif 'Pendaftaran' in r.nama or 'TU' in r.nama:
                candidate_staff = [p for p in pegawai_objs if p.profesi in ['Staf TU', 'Perawat']]
            else:
                candidate_staff = pegawai_objs

            if not candidate_staff:
                candidate_staff = pegawai_objs

            if day_of_week == 6 and 'IGD' not in r.nama and 'Rawat Inap' not in r.nama:
                continue # Closed on Sunday

            if 'IGD' in r.nama or 'Rawat Inap' in r.nama:
                shift_code = random.choice(['P', 'S', 'M'])
            else:
                shift_code = random.choice(['P', 'P', 'S'])

            available_candidates = [p for p in candidate_staff if p.id not in assigned_today]
            if not available_candidates:
                continue

            selected_pegawai = random.choice(available_candidates)
            assigned_today.add(selected_pegawai.id)

            jadwal = Jadwal(
                tanggal=date_str,
                pegawai_id=selected_pegawai.id,
                ruangan_id=r.id,
                shift_id=shift_objs[shift_code].id,
                catatan=''
            )
            db.session.add(jadwal)

        # Pegawai yang tidak bertugas pada hari tersebut dibiarkan tanpa jadwal (kosong/unassigned)
        # agar pengguna/admin dapat dengan mudah menugaskan mereka di hari mana saja.
        # Hanya buat entri Cuti sangat terbatas (opsional) untuk kebutuhan sampel demo.
        for p in pegawai_objs:
            if p.id not in assigned_today and random.random() < 0.02: # 2% chance untuk sampel demo cuti
                jadwal_off = Jadwal(
                    tanggal=date_str,
                    pegawai_id=p.id,
                    ruangan_id=None,
                    shift_id=shift_objs['C'].id,
                    catatan='Cuti Tahunan (Sampel Demo)'
                )
                db.session.add(jadwal_off)

        current += timedelta(days=1)

if __name__ == '__main__':
    # Generate template excel automatically
    generate_excel_template()

    if len(sys.argv) > 1:
        if sys.argv[1] == '--clear':
            clear_all_data()
            init_seed_data()
        elif sys.argv[1] == '--from-excel' and len(sys.argv) > 2:
            init_seed_data(excel_path=sys.argv[2])
        else:
            print("Usage: python seed.py [--clear | --from-excel <filepath>]")
    else:
        init_seed_data()
