import random
from datetime import datetime, timedelta
from app import app
from models import db, Pegawai, Ruangan, Shift, Jadwal, User, StatusJadwal

def init_seed_data():
    with app.app_context():
        db.drop_all()
        db.create_all()

        print("--> Seeding Master Shift...")
        shifts_data = [
            {'kode': 'P', 'nama': 'Pagi', 'jam_masuk': '07:30', 'jam_keluar': '14:00', 'warna_bg': '#0d9488', 'warna_text': '#ffffff'},   # Teal
            {'kode': 'S', 'nama': 'Siang', 'jam_masuk': '14:00', 'jam_keluar': '21:00', 'warna_bg': '#d97706', 'warna_text': '#ffffff'},  # Amber
            {'kode': 'M', 'nama': 'Malam', 'jam_masuk': '21:00', 'jam_keluar': '07:30', 'warna_bg': '#7c3aed', 'warna_text': '#ffffff'},  # Violet
            {'kode': 'ON', 'nama': 'On Call', 'jam_masuk': '24 Jam', 'jam_keluar': 'Standby', 'warna_bg': '#0284c7', 'warna_text': '#ffffff'}, # Light Blue
            {'kode': 'L', 'nama': 'Libur', 'jam_masuk': '-', 'jam_keluar': '-', 'warna_bg': '#334155', 'warna_text': '#94a3b8'},        # Slate Dark
            {'kode': 'C', 'nama': 'Cuti', 'jam_masuk': '-', 'jam_keluar': '-', 'warna_bg': '#e11d48', 'warna_text': '#ffffff'}          # Rose/Red
        ]
        
        shift_objs = {}
        for s in shifts_data:
            shift = Shift(**s)
            db.session.add(shift)
            db.session.flush()
            shift_objs[s['kode']] = shift

        print("--> Seeding Ruangan & Layanan (ILP Puskesmas)...")
        ruangan_data = [
            # Klaster 1: Manajemen
            {'nama': 'Pendaftaran & Rekam Medis', 'kode': 'RM', 'klaster': 'Klaster 1 (Manajemen)', 'urutan': 1},
            {'nama': 'Tata Usaha / Kasir', 'kode': 'TU', 'klaster': 'Klaster 1 (Manajemen)', 'urutan': 2},
            
            # Klaster 2: Ibu & Anak
            {'nama': 'Poli KIA & KB', 'kode': 'KIA', 'klaster': 'Klaster 2 (Ibu & Anak)', 'urutan': 3},
            {'nama': 'Poli Anak & Imunisasi', 'kode': 'IMN', 'klaster': 'Klaster 2 (Ibu & Anak)', 'urutan': 4},
            
            # Klaster 3: Dewasa & Lansia
            {'nama': 'Poli Umum', 'kode': 'UMM', 'klaster': 'Klaster 3 (Dewasa & Lansia)', 'urutan': 5},
            {'nama': 'Poli Gigi & Mulut', 'kode': 'GGI', 'klaster': 'Klaster 3 (Dewasa & Lansia)', 'urutan': 6},
            {'nama': 'Poli Lansia & PTM', 'kode': 'PTM', 'klaster': 'Klaster 3 (Dewasa & Lansia)', 'urutan': 7},
            
            # Klaster 4: P2P & Penunjang
            {'nama': 'Farmasi / Apotek', 'kode': 'APT', 'klaster': 'Klaster 4 (P2P & Penunjang)', 'urutan': 8},
            {'nama': 'Laboratorium', 'kode': 'LAB', 'klaster': 'Klaster 4 (P2P & Penunjang)', 'urutan': 9},
            {'nama': 'Ruang Gizi & Kesling', 'kode': 'GZI', 'klaster': 'Klaster 4 (P2P & Penunjang)', 'urutan': 10},
            
            # Lintas Klaster
            {'nama': 'IGD / Gawat Darurat (24 Jam)', 'kode': 'IGD', 'klaster': 'Lintas Klaster', 'urutan': 11},
            {'nama': 'Ruang Rawat Inap', 'kode': 'RNI', 'klaster': 'Lintas Klaster', 'urutan': 12},
            
            # Luar Induk
            {'nama': 'Pustu Desa Sukamaju', 'kode': 'PST1', 'klaster': 'Luar Induk', 'urutan': 13},
            {'nama': 'Poskesdes Harapan', 'kode': 'POS1', 'klaster': 'Luar Induk', 'urutan': 14},
            {'nama': 'Puskesmas Keliling (Pusling)', 'kode': 'PSL', 'klaster': 'Luar Induk', 'urutan': 15}
        ]

        ruangan_objs = []
        for r in ruangan_data:
            ruang = Ruangan(**r)
            db.session.add(ruang)
            db.session.flush()
            ruangan_objs.append(ruang)

        print("--> Seeding Pegawai SDMK...")
        pegawai_data = [
            {'nip': '198503122010011001', 'nama': 'dr. Ahmad Fauzi, Sp.KKLP', 'profesi': 'Dokter Umum', 'no_hp': '081234567801'},
            {'nip': '198807202014022003', 'nama': 'dr. Siti Rahmawati', 'profesi': 'Dokter Umum', 'no_hp': '081234567802'},
            {'nip': '199011052016031005', 'nama': 'drg. Maya Indah', 'profesi': 'Dokter Gigi', 'no_hp': '081234567803'},
            
            {'nip': '198904152012012004', 'nama': 'Bdn. Rina Amalia, S.Tr.Keb', 'profesi': 'Bidan', 'no_hp': '081234567804'},
            {'nip': '199208102015032008', 'nama': 'Bdn. Dewi Lestari, Amd.Keb', 'profesi': 'Bidan', 'no_hp': '081234567805'},
            {'nip': '199401222018022009', 'nama': 'Bdn. Nur Hidayah, Amd.Keb', 'profesi': 'Bidan', 'no_hp': '081234567806'},
            
            {'nip': '198709182011011002', 'nama': 'Ns. Hendra Kurniawan, S.Kep', 'profesi': 'Perawat', 'no_hp': '081234567807'},
            {'nip': '199105302014021006', 'nama': 'Ns. Andi Pratama, S.Kep', 'profesi': 'Perawat', 'no_hp': '081234567808'},
            {'nip': '199303142017032010', 'nama': 'Siska Putri, Amd.Kep', 'profesi': 'Perawat', 'no_hp': '081234567809'},
            {'nip': '199512012019011011', 'nama': 'Budi Santoso, Amd.Kep', 'profesi': 'Perawat', 'no_hp': '081234567810'},
            
            {'nip': '198610112009022001', 'nama': 'apt. Fitriani, S.Farm', 'profesi': 'Apoteker', 'no_hp': '081234567811'},
            {'nip': '199406182018012012', 'nama': 'Dian Permata, Amd.Farm', 'profesi': 'Asisten Apoteker', 'no_hp': '081234567812'},
            
            {'nip': '199102282015031007', 'nama': 'Rahmat Hidayat, Amd.AK', 'profesi': 'Pranata Laboratorium', 'no_hp': '081234567813'},
            {'nip': '199307042017022013', 'nama': 'Lilis Suryani, S.Gz', 'profesi': 'Nutrisionis', 'no_hp': '081234567814'},
            {'nip': '199211192016011008', 'nama': 'Eko Prasetyo, SKM', 'profesi': 'Sanitarian', 'no_hp': '081234567815'},
            
            {'nip': '198405122008011003', 'nama': 'Agus Wijaya', 'profesi': 'Staf TU', 'no_hp': '081234567816'},
            {'nip': '199609252020012014', 'nama': 'Nita Sari', 'profesi': 'Staf TU', 'no_hp': '081234567817'}
        ]

        pegawai_objs = []
        for p in pegawai_data:
            peg = Pegawai(**p)
            db.session.add(peg)
            db.session.flush()
            pegawai_objs.append(peg)

        print("--> Seeding User Accounts (Roles: admin, kapus, pegawai)...")
        # 1. Admin SDMK
        u_admin = User(username='admin', role='admin')
        u_admin.set_password('admin123')
        db.session.add(u_admin)

        # 2. Kepala Puskesmas
        u_kapus = User(username='kapus', role='kapus')
        u_kapus.set_password('kapus123')
        db.session.add(u_kapus)

        # 3. Sample Pegawai Users
        u_dr_ahmad = User(username='dr.ahmad', role='pegawai', pegawai_id=pegawai_objs[0].id)
        u_dr_ahmad.set_password('user123')
        db.session.add(u_dr_ahmad)

        u_ns_hendra = User(username='ns.hendra', role='pegawai', pegawai_id=pegawai_objs[6].id)
        u_ns_hendra.set_password('user123')
        db.session.add(u_ns_hendra)

        u_bdn_rina = User(username='bdn.rina', role='pegawai', pegawai_id=pegawai_objs[3].id)
        u_bdn_rina.set_password('user123')
        db.session.add(u_bdn_rina)

        print("--> Seeding Status Jadwal (August 2026 -> DRAFT)...")
        st_aug = StatusJadwal(tahun=2026, bulan=8, status='DRAFT')
        db.session.add(st_aug)

        print("--> Generating Sample Schedule for August 2026...")
        year = 2026
        month = 8
        
        start_date = datetime(year, month, 1)
        end_date = datetime(year, month, 31)

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
                    continue # Closed on Sunday!

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

            # Assign Libur (L) & Cuti (C) status for staff who have no room duty on date_str
            for p in pegawai_objs:
                if p.id not in assigned_today:
                    off_code = 'C' if random.random() < 0.1 else 'L'
                    jadwal_off = Jadwal(
                        tanggal=date_str,
                        pegawai_id=p.id,
                        ruangan_id=None,
                        shift_id=shift_objs[off_code].id,
                        catatan='Libur Rutin' if off_code == 'L' else 'Cuti Tahunan'
                    )
                    db.session.add(jadwal_off)

            current += timedelta(days=1)

        db.session.commit()
        print("--> Database Seeding Complete successfully!")

if __name__ == '__main__':
    init_seed_data()
