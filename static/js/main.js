// Application Global State
const state = {
    year: new Date().getFullYear(),
    month: 8, // Default August
    num_days: 31,
    month_name: 'Agustus',
    current_user: null, // { id, username, role, pegawai_id, pegawai_nama }
    status_jadwal: { status: 'DRAFT', approved_by: '', approved_at: '' },
    pegawai_list: [],
    ruangan_list: [],
    shift_list: [],
    jadwal_list: [],
    conflicts: [],
    selectedCell: null, // { tanggal, ruangan_id }
    selectedHarianDate: null,
    dragData: null // { type: 'shift'|'pegawai', id: number }
};

const INDONESIAN_DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

document.addEventListener('DOMContentLoaded', () => {
    // Initialize date selects
    const selectMonth = document.getElementById('select-month');
    const selectYear = document.getElementById('select-year');
    
    selectMonth.value = state.month;
    selectYear.value = state.year;

    selectMonth.addEventListener('change', (e) => {
        state.month = parseInt(e.target.value);
        loadDashboardData();
    });

    selectYear.addEventListener('change', (e) => {
        state.year = parseInt(e.target.value);
        loadDashboardData();
    });

    // Search & Filter Pegawai Sidebar
    document.getElementById('search-pegawai').addEventListener('input', renderPegawaiPalette);
    document.getElementById('filter-profesi').addEventListener('change', renderPegawaiPalette);

    loadDashboardData();
});

// Load Data from Backend API
async function loadDashboardData() {
    try {
        const res = await fetch(`/api/data?year=${state.year}&month=${state.month}`);
        const data = await res.json();
        
        if (data.status === 'success') {
            state.year = data.year;
            state.month = data.month;
            state.num_days = data.num_days;
            state.month_name = data.month_name;
            state.current_user = data.current_user;
            state.status_jadwal = data.status_jadwal || { status: 'DRAFT' };
            state.pegawai_list = data.pegawai_list;
            state.ruangan_list = data.ruangan_list;
            state.shift_list = data.shift_list;
            state.jadwal_list = data.jadwal_list;
            state.conflicts = data.conflicts;

            // Render Auth & Approval Bar
            renderUserProfile();
            renderApprovalControlBar();

            // Render Conflict Banner
            renderConflicts();

            // Populate Sidebar Palettes & Modals
            renderShiftPalette();
            renderPegawaiPalette();
            populateModalDropdowns();

            // Enforce Role & Locking UI Restrictions
            applyRoleAndLockingRestrictions();

            // Render Current Active Tab
            renderActiveTab();
        }
    } catch (err) {
        console.error("Error loading dashboard data:", err);
    }
}

// -------------------------------------------------------------
// USER AUTH & ROLE PROFILES
// -------------------------------------------------------------
function renderUserProfile() {
    const container = document.getElementById('user-profile-badge');
    if (!container) return;

    if (state.current_user) {
        const u = state.current_user;
        let roleColor = 'bg-slate-800 text-slate-300 border-slate-700';
        if (u.role === 'admin') roleColor = 'bg-teal-950 text-teal-400 border-teal-800';
        else if (u.role === 'kapus') roleColor = 'bg-amber-950 text-amber-400 border-amber-800';

        container.innerHTML = `
            <div class="flex items-center gap-2">
                <div class="text-right hidden sm:block">
                    <span class="text-xs font-bold text-slate-200 block truncate max-w-[140px]">${u.pegawai_nama}</span>
                    <span class="text-[10px] px-1.5 py-0.2 rounded border font-semibold ${roleColor}">${u.role.toUpperCase()}</span>
                </div>
                <button onclick="submitLogout()" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition" title="Logout">
                    <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
                </button>
            </div>
        `;
    } else {
        container.innerHTML = `
            <button onclick="openLoginModal()" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md shadow-teal-900/30 transition">
                <i data-lucide="log-in" class="w-3.5 h-3.5"></i>
                Login Akun
            </button>
        `;
    }
    if (window.lucide) lucide.createIcons();
}

// -------------------------------------------------------------
// APPROVAL WORKFLOW CONTROL BAR
// -------------------------------------------------------------
function renderApprovalControlBar() {
    const statusBadge = document.getElementById('approval-status-badge');
    const actionButtons = document.getElementById('approval-action-buttons');
    if (!statusBadge || !actionButtons) return;

    const st = state.status_jadwal.status;
    const approvedBy = state.status_jadwal.approved_by;

    if (st === 'FINAL') {
        statusBadge.innerHTML = `
            <span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1.5">
                <i data-lucide="lock" class="w-3.5 h-3.5"></i>
                STATUS: FINAL APPROVED (RESMI)
            </span>
            <span class="text-[11px] text-slate-400 hidden sm:inline">Disetujui oleh: <strong class="text-slate-200">${approvedBy}</strong></span>
        `;
    } else if (st === 'SUBMITTED') {
        statusBadge.innerHTML = `
            <span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-950 text-sky-400 border border-sky-800 flex items-center gap-1.5">
                <i data-lucide="clock" class="w-3.5 h-3.5 animate-spin"></i>
                STATUS: MENUNGGU REVIEW KEPALA PUSKESMAS
            </span>
            <span class="text-[11px] text-slate-400 hidden sm:inline">Jadwal telah diajukan oleh Admin.</span>
        `;
    } else {
        statusBadge.innerHTML = `
            <span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-950 text-amber-400 border border-amber-800 flex items-center gap-1.5">
                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                STATUS: DRAFT (Penyusunan Jadwal)
            </span>
            <span class="text-[11px] text-slate-400 hidden sm:inline">Jadwal belum disahkan.</span>
        `;
    }

    actionButtons.innerHTML = '';
    const userRole = state.current_user ? state.current_user.role : null;

    if (userRole === 'admin' && st === 'DRAFT') {
        actionButtons.innerHTML = `
            <button onclick="updateScheduleStatus('submit')" class="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-md shadow-sky-900/30">
                <i data-lucide="send" class="w-3.5 h-3.5"></i>
                Ajukan Ke Kepala Puskesmas
            </button>
        `;
    }

    if (userRole === 'kapus') {
        if (st !== 'FINAL') {
            actionButtons.innerHTML += `
                <button onclick="updateScheduleStatus('approve')" class="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-md shadow-emerald-900/30">
                    <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>
                    Setujui & Finalkan Jadwal
                </button>
            `;
        }
        if (st === 'SUBMITTED' || st === 'FINAL') {
            actionButtons.innerHTML += `
                <button onclick="updateScheduleStatus('revert')" class="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold transition flex items-center gap-1 border border-slate-700">
                    <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                    Kembalikan ke Draf
                </button>
            `;
        }
    }

    if (window.lucide) lucide.createIcons();
}

async function updateScheduleStatus(action) {
    try {
        const res = await fetch('/api/jadwal/status/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                year: state.year,
                month: state.month,
                action: action
            })
        });

        const data = await res.json();
        if (data.status === 'success') {
            alert(data.message);
            loadDashboardData();
        } else {
            alert(data.message || 'Gagal mengubah status');
        }
    } catch (err) {
        console.error("Status update error:", err);
    }
}

// Enforce Role & Locking Restrictions on UI
function applyRoleAndLockingRestrictions() {
    const sidebar = document.getElementById('sidebar-palette-container');
    const btnBulk = document.getElementById('btn-bulk-mapping');
    const btnManageLayanan = document.getElementById('btn-manage-layanan');
    const isLocked = state.status_jadwal.status === 'FINAL';
    const userRole = state.current_user ? state.current_user.role : 'pegawai';

    if (userRole === 'pegawai' || isLocked) {
        if (sidebar) sidebar.classList.add('hidden');
        if (btnBulk) btnBulk.classList.add('hidden');
        if (btnManageLayanan) btnManageLayanan.classList.add('hidden');
    } else {
        if (sidebar) sidebar.classList.remove('hidden');
        if (btnBulk) btnBulk.classList.remove('hidden');
        if (btnManageLayanan) btnManageLayanan.classList.remove('hidden');
    }

    if (userRole === 'pegawai' && state.current_user && state.current_user.pegawai_id) {
        const selectDetail = document.getElementById('select-pegawai-detail');
        if (selectDetail) {
            selectDetail.value = state.current_user.pegawai_id;
        }
    }
}

// -------------------------------------------------------------
// KELOLA RUANGAN / LAYANAN MODAL LOGIC
// -------------------------------------------------------------
function openRuanganModal() {
    renderRuanganManagerList();
    document.getElementById('modal-ruangan').classList.remove('hidden');
}

function closeRuanganModal() {
    document.getElementById('modal-ruangan').classList.add('hidden');
}

function renderRuanganManagerList() {
    const container = document.getElementById('ruangan-manager-list');
    if (!container) return;

    container.innerHTML = '';
    state.ruangan_list.forEach(r => {
        const card = document.createElement('div');
        card.className = 'p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs';
        card.innerHTML = `
            <div>
                <span class="font-bold text-slate-200 block">${r.nama} (${r.kode})</span>
                <span class="text-[10px] text-teal-400 font-medium">${r.klaster} | Urutan: ${r.urutan}</span>
            </div>
            <button onclick="deleteRuangan(${r.id})" class="px-2.5 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 text-[11px] font-semibold border border-rose-800 transition">
                Hapus
            </button>
        `;
        container.appendChild(card);
    });
}

async function saveNewRuangan() {
    const nama = document.getElementById('add-ruang-nama').value.trim();
    const kode = document.getElementById('add-ruang-kode').value.trim();
    const klaster = document.getElementById('add-ruang-klaster').value;
    const urutan = document.getElementById('add-ruang-urutan').value;

    if (!nama) {
        alert('Harap isi nama layanan!');
        return;
    }

    try {
        const res = await fetch('/api/ruangan/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nama, kode, klaster, urutan })
        });
        const data = await res.json();
        if (data.status === 'success') {
            document.getElementById('add-ruang-nama').value = '';
            document.getElementById('add-ruang-kode').value = '';
            alert(data.message);
            loadDashboardData();
            setTimeout(renderRuanganManagerList, 300);
        } else {
            alert(data.message || 'Gagal menambah layanan');
        }
    } catch (err) {
        console.error("Add ruangan error:", err);
    }
}

async function deleteRuangan(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus layanan ini? Jadwal terkait layanan ini juga akan terhapus.')) return;

    try {
        const res = await fetch('/api/ruangan/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (data.status === 'success') {
            loadDashboardData();
            setTimeout(renderRuanganManagerList, 300);
        } else {
            alert(data.message || 'Gagal menghapus');
        }
    } catch (err) {
        console.error("Delete ruangan error:", err);
    }
}

// -------------------------------------------------------------
// LOGIN / LOGOUT MODAL HANDLERS
// -------------------------------------------------------------
function openLoginModal() {
    document.getElementById('login-error').classList.add('hidden');
    document.getElementById('modal-login').classList.remove('hidden');
}

function closeLoginModal() {
    document.getElementById('modal-login').classList.add('hidden');
}

function fillLogin(u, p) {
    document.getElementById('login-username').value = u;
    document.getElementById('login-password').value = p;
}

async function submitLogin() {
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value.trim();
    const errDiv = document.getElementById('login-error');

    if (!u || !p) {
        errDiv.textContent = 'Harap isi username dan password!';
        errDiv.classList.remove('hidden');
        return;
    }

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });
        const data = await res.json();

        if (data.status === 'success') {
            closeLoginModal();
            loadDashboardData();
        } else {
            errDiv.textContent = data.message || 'Login gagal';
            errDiv.classList.remove('hidden');
        }
    } catch (err) {
        errDiv.textContent = 'Terjadi kesalahan koneksi server';
        errDiv.classList.remove('hidden');
    }
}

async function submitLogout() {
    await fetch('/api/logout', { method: 'POST' });
    loadDashboardData();
}

// Render Conflict Alert Banner (Compact & Sleek)
function renderConflicts() {
    const banner = document.getElementById('conflict-banner');
    const badge = document.getElementById('conflict-count-badge');
    
    if (state.conflicts && state.conflicts.length > 0) {
        banner.classList.remove('hidden');
        badge.textContent = `Terdeteksi ${state.conflicts.length} Peringatan Jadwal Bentrok`;
    } else {
        banner.classList.add('hidden');
    }
}

function openConflictModal() {
    const modalList = document.getElementById('conflict-modal-list');
    modalList.innerHTML = '';

    if (!state.conflicts || state.conflicts.length === 0) {
        modalList.innerHTML = `<div class="p-3 text-center text-xs text-slate-500">Tidak ada jadwal bentrok.</div>`;
    } else {
        state.conflicts.forEach(c => {
            const card = document.createElement('div');
            card.className = 'p-3 rounded-xl bg-slate-950 border border-rose-900/60 flex flex-col gap-1.5';
            
            const roomsText = c.details.map(d => `${d.ruangan_nama} (Shift ${d.shift_kode})`).join(' & ');

            card.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="font-bold text-xs text-rose-200">${c.pegawai_nama}</span>
                    <span class="px-2 py-0.5 rounded bg-rose-950 text-rose-400 font-bold text-[10px] border border-rose-800">${c.tanggal}</span>
                </div>
                <div class="text-[11px] text-slate-300">
                    <span class="text-slate-500 font-medium">Bertugas ganda di:</span> ${roomsText}
                </div>
            `;
            modalList.appendChild(card);
        });
    }

    document.getElementById('modal-conflict').classList.remove('hidden');
}

function closeConflictModal() {
    document.getElementById('modal-conflict').classList.add('hidden');
}

// Render Master Shift Badges Palette in Sidebar
function renderShiftPalette() {
    const container = document.getElementById('shift-palette');
    container.innerHTML = '';

    state.shift_list.forEach(s => {
        const badge = document.createElement('div');
        badge.className = 'px-2 py-1.5 rounded-lg text-center font-bold text-xs cursor-grab active:cursor-grabbing border border-slate-700 shadow-sm transition hover:scale-105 select-none';
        badge.style.backgroundColor = s.warna_bg;
        badge.style.color = s.warna_text;
        badge.innerHTML = `<span class="block text-[10px] opacity-80 font-normal">${s.nama}</span>${s.kode}`;
        
        badge.draggable = true;
        badge.addEventListener('dragstart', (e) => {
            state.dragData = { type: 'shift', id: s.id };
            e.dataTransfer.setData('text/plain', JSON.stringify(state.dragData));
        });

        container.appendChild(badge);
    });
}

// Render Staff Cards Palette in Sidebar
function renderPegawaiPalette() {
    const container = document.getElementById('pegawai-palette');
    const searchVal = document.getElementById('search-pegawai').value.toLowerCase();
    const profesiVal = document.getElementById('filter-profesi').value;

    const filtered = state.pegawai_list.filter(p => {
        const matchSearch = p.nama.toLowerCase().includes(searchVal) || p.profesi.toLowerCase().includes(searchVal);
        const matchProfesi = profesiVal === '' || p.profesi === profesiVal;
        return matchSearch && matchProfesi;
    });

    document.getElementById('pegawai-count').textContent = filtered.length;
    container.innerHTML = '';

    filtered.forEach(p => {
        const card = document.createElement('div');
        card.className = 'p-2 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-teal-500/50 cursor-grab active:cursor-grabbing text-xs transition flex items-center justify-between group select-none';
        card.innerHTML = `
            <div class="overflow-hidden">
                <span class="font-semibold text-slate-200 block truncate">${p.nama}</span>
                <span class="text-[10px] text-teal-400 font-medium">${p.profesi}</span>
            </div>
            <i data-lucide="grip-vertical" class="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 shrink-0"></i>
        `;

        card.draggable = true;
        card.addEventListener('dragstart', (e) => {
            state.dragData = { type: 'pegawai', id: p.id };
            e.dataTransfer.setData('text/plain', JSON.stringify(state.dragData));
        });

        container.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();
}

// Tab Switcher Handler
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-slate-800', 'text-teal-400', 'border', 'border-slate-700');
        btn.classList.add('text-slate-400');
    });

    const activeBtn = document.getElementById(`nav-${tabId}`);
    if (activeBtn) {
        activeBtn.classList.add('bg-slate-800', 'text-teal-400', 'border', 'border-slate-700');
        activeBtn.classList.remove('text-slate-400');
    }

    document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');

    renderActiveTab();
}

function renderActiveTab() {
    if (!document.getElementById('tab-klaster').classList.contains('hidden')) {
        renderMatrixKlaster();
    } else if (!document.getElementById('tab-profesi').classList.contains('hidden')) {
        renderMatrixProfesi();
    } else if (!document.getElementById('tab-harian').classList.contains('hidden')) {
        renderHarianTab();
    } else if (!document.getElementById('tab-pegawai').classList.contains('hidden')) {
        const selectDetail = document.getElementById('select-pegawai-detail');
        if (selectDetail.value) {
            renderPegawaiDetail(selectDetail.value);
        }
    }
}

// -------------------------------------------------------------
// TAB 1: Matriks Klaster & Layanan (Ruangan vs Tanggal)
// -------------------------------------------------------------
function renderMatrixKlaster() {
    const headerTr = document.getElementById('matrix-header-days');
    const tbody = document.getElementById('matrix-body-klaster');

    let headerHTML = `
        <th class="p-2 w-10 text-center sticky-col-1 bg-slate-950 border-r border-slate-800 font-bold">No</th>
        <th class="p-2 w-44 sticky-col-2 bg-slate-950 border-r border-slate-800 font-bold">Ruangan / Layanan</th>
    `;

    for (let day = 1; day <= state.num_days; day++) {
        const dateObj = new Date(state.year, state.month - 1, day);
        const dayIdx = dateObj.getDay();
        const dayName = INDONESIAN_DAYS[dayIdx === 0 ? 6 : dayIdx - 1];
        const isSunday = dayIdx === 0;

        headerHTML += `
            <th class="p-1 w-12 text-center border-r border-slate-800/60 font-semibold ${isSunday ? 'bg-rose-950/40 text-rose-400' : ''}">
                <span class="block text-[10px] text-slate-400">${dayName}</span>
                <span class="text-xs font-bold">${day}</span>
            </th>
        `;
    }
    headerTr.innerHTML = headerHTML;

    tbody.innerHTML = '';
    let currentKlaster = null;
    let rowNo = 1;

    const scheduleMap = {};
    state.jadwal_list.forEach(j => {
        scheduleMap[`${j.ruangan_id}_${j.tanggal}`] = j;
    });

    const isLocked = state.status_jadwal.status === 'FINAL';
    const userRole = state.current_user ? state.current_user.role : 'pegawai';

    state.ruangan_list.forEach(r => {
        if (r.klaster !== currentKlaster) {
            currentKlaster = r.klaster;
            const groupTr = document.createElement('tr');
            groupTr.className = 'bg-slate-950/90 text-teal-400 font-bold border-y border-slate-800';
            groupTr.innerHTML = `
                <td colspan="${state.num_days + 2}" class="p-2 text-xs uppercase tracking-wider pl-4">
                    <i data-lucide="folder-kanban" class="w-3.5 h-3.5 inline mr-1 text-teal-400"></i>
                    ${currentKlaster}
                </td>
            `;
            tbody.appendChild(groupTr);
        }

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/30 transition';

        let rowHTML = `
            <td class="p-2 text-center sticky-col-1 bg-slate-900 border-r border-slate-800 text-slate-400 font-medium">${rowNo++}</td>
            <td class="p-2 sticky-col-2 bg-slate-900 border-r border-slate-800 font-bold text-slate-200">
                <span class="block text-xs">${r.nama}</span>
                <span class="text-[10px] text-slate-500 font-normal">${r.kode}</span>
            </td>
        `;

        for (let day = 1; day <= state.num_days; day++) {
            const tglStr = `${state.year}-${String(state.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const key = `${r.id}_${tglStr}`;
            const j = scheduleMap[key];

            let cellContent = '-';
            let staffTitle = '';

            if (j) {
                const shiftCode = j.shift_kode;
                const staffName = j.pegawai_nama ? j.pegawai_nama.split(' ')[0] : '';
                cellContent = `
                    <div class="px-1 py-0.5 rounded text-[10px] font-bold text-center border border-white/10 overflow-hidden shadow-sm" style="background-color: ${j.warna_bg}; color: ${j.warna_text}">
                        <span>${shiftCode}</span>
                        <span class="block text-[9px] font-normal truncate opacity-90">${staffName}</span>
                    </div>
                `;
                staffTitle = `${j.pegawai_nama} (${j.shift_nama})`;
            }

            const canEdit = !isLocked && (userRole === 'admin' || userRole === 'kapus');
            const pointerClass = canEdit ? 'cursor-pointer hover:bg-teal-950/40 dropzone' : 'cursor-default';
            const clickAttr = canEdit ? `onclick="openCellModal('${tglStr}', ${r.id})"` : '';

            rowHTML += `
                <td class="p-1 border-r border-b border-slate-800/40 text-center transition ${pointerClass}"
                    data-tanggal="${tglStr}"
                    data-ruangan-id="${r.id}"
                    title="${staffTitle}"
                    ${clickAttr}>
                    ${cellContent}
                </td>
            `;
        }

        tr.innerHTML = rowHTML;
        tbody.appendChild(tr);
    });

    if (!isLocked && (userRole === 'admin' || userRole === 'kapus')) {
        attachDropzoneListeners();
    }
    if (window.lucide) lucide.createIcons();
}

// -------------------------------------------------------------
// TAB 2: View By Profesi
// -------------------------------------------------------------
function renderMatrixProfesi() {
    const headerTr = document.getElementById('profesi-header-days');
    const tbody = document.getElementById('matrix-body-profesi');

    let headerHTML = `
        <th class="p-2 w-10 text-center sticky-col-1 bg-slate-950 border-r border-slate-800 font-bold">No</th>
        <th class="p-2 w-48 sticky-col-2 bg-slate-950 border-r border-slate-800 font-bold">Nama Pegawai & Profesi</th>
    `;

    for (let day = 1; day <= state.num_days; day++) {
        const dateObj = new Date(state.year, state.month - 1, day);
        const dayIdx = dateObj.getDay();
        const dayName = INDONESIAN_DAYS[dayIdx === 0 ? 6 : dayIdx - 1];
        headerHTML += `
            <th class="p-1 w-12 text-center border-r border-slate-800/60 font-semibold">
                <span class="block text-[10px] text-slate-400">${dayName}</span>
                <span class="text-xs font-bold">${day}</span>
            </th>
        `;
    }
    headerTr.innerHTML = headerHTML;

    tbody.innerHTML = '';
    let currentProfesi = null;
    let rowNo = 1;

    const sortedPegawai = [...state.pegawai_list].sort((a, b) => a.profesi.localeCompare(b.profesi));

    const pegawaiJadwalMap = {};
    state.jadwal_list.forEach(j => {
        const k = `${j.pegawai_id}_${j.tanggal}`;
        if (!pegawaiJadwalMap[k]) pegawaiJadwalMap[k] = [];
        pegawaiJadwalMap[k].push(j);
    });

    sortedPegawai.forEach(p => {
        if (p.profesi !== currentProfesi) {
            currentProfesi = p.profesi;
            const groupTr = document.createElement('tr');
            groupTr.className = 'bg-slate-950/90 text-teal-400 font-bold border-y border-slate-800';
            groupTr.innerHTML = `
                <td colspan="${state.num_days + 2}" class="p-2 text-xs uppercase tracking-wider pl-4">
                    <i data-lucide="user-check" class="w-3.5 h-3.5 inline mr-1 text-teal-400"></i>
                    Profesi: ${currentProfesi}
                </td>
            `;
            tbody.appendChild(groupTr);
        }

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/30 transition';

        let rowHTML = `
            <td class="p-2 text-center sticky-col-1 bg-slate-900 border-r border-slate-800 text-slate-400 font-medium">${rowNo++}</td>
            <td class="p-2 sticky-col-2 bg-slate-900 border-r border-slate-800 font-bold text-slate-200">
                <span class="block text-xs truncate">${p.nama}</span>
                <span class="text-[10px] text-teal-400 font-normal">${p.profesi}</span>
            </td>
        `;

        for (let day = 1; day <= state.num_days; day++) {
            const tglStr = `${state.year}-${String(state.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const listJ = pegawaiJadwalMap[`${p.id}_${tglStr}`] || [];

            let cellContent = '-';
            if (listJ.length > 0) {
                cellContent = listJ.map(j => `
                    <div class="px-1 py-0.5 rounded text-[10px] font-bold text-center border border-white/10 mb-0.5" style="background-color: ${j.warna_bg}; color: ${j.warna_text}" title="${j.ruangan_nama}">
                        <span>${j.shift_kode}</span>
                    </div>
                `).join('');
            }

            rowHTML += `
                <td class="p-1 border-r border-b border-slate-800/40 text-center">
                    ${cellContent}
                </td>
            `;
        }

        tr.innerHTML = rowHTML;
        tbody.appendChild(tr);
    });

    if (window.lucide) lucide.createIcons();
}

// -------------------------------------------------------------
// TAB 3: View Harian / Mobile Card View
// -------------------------------------------------------------
function renderHarianTab() {
    const carousel = document.getElementById('harian-date-carousel');
    carousel.innerHTML = '';

    if (!state.selectedHarianDate) {
        state.selectedHarianDate = `${state.year}-${String(state.month).padStart(2, '0')}-01`;
    }

    for (let day = 1; day <= state.num_days; day++) {
        const tglStr = `${state.year}-${String(state.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isSelected = tglStr === state.selectedHarianDate;

        const pill = document.createElement('button');
        pill.className = `px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition ${isSelected ? 'bg-teal-600 text-white shadow-md shadow-teal-900/40' : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`;
        pill.textContent = `Tgl ${day}`;
        pill.onclick = () => {
            state.selectedHarianDate = tglStr;
            renderHarianTab();
        };

        carousel.appendChild(pill);
    }

    renderHarianCards(state.selectedHarianDate);
}

function renderHarianCards(dateStr) {
    const container = document.getElementById('harian-cards-container');
    container.innerHTML = '';

    const dayJadwals = state.jadwal_list.filter(j => j.tanggal === dateStr);
    const dayJadwalMap = {};
    dayJadwals.forEach(j => {
        dayJadwalMap[j.ruangan_id] = j;
    });

    const isLocked = state.status_jadwal.status === 'FINAL';
    const userRole = state.current_user ? state.current_user.role : 'pegawai';

    state.ruangan_list.forEach(r => {
        const j = dayJadwalMap[r.id];
        const card = document.createElement('div');
        card.className = 'bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between hover:border-slate-700 transition shadow-lg';

        let shiftBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-500">Belum diatur</span>`;
        let staffName = 'Belum Ada Pegawai Jaga';
        let staffProfesi = '-';

        if (j) {
            shiftBadge = `
                <span class="px-2.5 py-1 rounded-lg text-xs font-extrabold border border-white/10 shadow-sm" style="background-color: ${j.warna_bg}; color: ${j.warna_text}">
                    Shift ${j.shift_nama} (${j.shift_kode})
                </span>
            `;
            staffName = j.pegawai_nama;
            staffProfesi = j.pegawai_profesi;
        }

        const editBtnHTML = (!isLocked && (userRole === 'admin' || userRole === 'kapus')) ? `
            <button onclick="openCellModal('${dateStr}', ${r.id})" class="mt-3 w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition text-center">
                Ubah Jadwal
            </button>
        ` : '';

        card.innerHTML = `
            <div class="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2 mb-2">
                <div>
                    <h4 class="text-xs font-bold text-slate-100">${r.nama}</h4>
                    <span class="text-[10px] text-teal-400 font-medium">${r.klaster}</span>
                </div>
                ${shiftBadge}
            </div>

            <div class="flex items-center gap-2.5 py-1">
                <div class="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-teal-400 font-bold text-xs shrink-0">
                    <i data-lucide="user" class="w-4 h-4"></i>
                </div>
                <div>
                    <span class="text-xs font-bold text-slate-200 block">${staffName}</span>
                    <span class="text-[10px] text-slate-400">${staffProfesi}</span>
                </div>
            </div>

            ${editBtnHTML}
        `;

        container.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();
}

// -------------------------------------------------------------
// TAB 4: Detail Pegawai (Individual Monthly View)
// -------------------------------------------------------------
function populateModalDropdowns() {
    const selectDetail = document.getElementById('select-pegawai-detail');
    selectDetail.innerHTML = '<option value="">-- Pilih Pegawai --</option>';
    
    state.pegawai_list.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.nama} (${p.profesi})`;
        selectDetail.appendChild(opt);
    });

    if (state.pegawai_list.length > 0 && !selectDetail.value) {
        selectDetail.value = state.pegawai_list[0].id;
    }
}

function renderPegawaiDetail(pegawaiId) {
    if (!pegawaiId) return;

    const peg = state.pegawai_list.find(p => p.id == pegawaiId);
    if (!peg) return;

    document.getElementById('pegawai-detail-name').textContent = peg.nama;
    document.getElementById('pegawai-detail-nip').textContent = `NIP: ${peg.nip} | Profesi: ${peg.profesi}`;

    const staffJadwals = state.jadwal_list.filter(j => j.pegawai_id == pegawaiId);

    let countPagi = 0, countSiang = 0, countMalam = 0, countLibur = 0;
    const dateJadwalMap = {};

    staffJadwals.forEach(j => {
        dateJadwalMap[j.tanggal] = j;
        if (j.shift_kode === 'P') countPagi++;
        else if (j.shift_kode === 'S') countSiang++;
        else if (j.shift_kode === 'M') countMalam++;
        else if (['L', 'C'].includes(j.shift_kode)) countLibur++;
    });

    document.getElementById('stat-pagi').textContent = countPagi;
    document.getElementById('stat-siang').textContent = countSiang;
    document.getElementById('stat-malam').textContent = countMalam;
    document.getElementById('stat-libur').textContent = countLibur;

    const calGrid = document.getElementById('pegawai-calendar-grid');
    calGrid.innerHTML = '';

    INDONESIAN_DAYS.forEach(d => {
        const dh = document.createElement('div');
        dh.className = 'font-bold text-[11px] text-slate-400 py-1 border-b border-slate-800';
        dh.textContent = d;
        calGrid.appendChild(dh);
    });

    for (let day = 1; day <= state.num_days; day++) {
        const tglStr = `${state.year}-${String(state.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const j = dateJadwalMap[tglStr];

        const cell = document.createElement('div');
        cell.className = 'bg-slate-900/60 border border-slate-800 rounded-lg p-2 flex flex-col items-center justify-between h-16';

        let badge = `<span class="text-[10px] text-slate-600 font-medium">-</span>`;
        if (j) {
            badge = `
                <div class="px-1.5 py-0.5 rounded text-[10px] font-bold w-full truncate border border-white/10 text-center" style="background-color: ${j.warna_bg}; color: ${j.warna_text}">
                    ${j.shift_kode} - ${j.ruangan_nama.split(' ')[0]}
                </div>
            `;
        }

        cell.innerHTML = `
            <span class="text-xs font-bold text-slate-300 self-start">${day}</span>
            ${badge}
        `;

        calGrid.appendChild(cell);
    }
}

// -------------------------------------------------------------
// Drag and Drop Handlers
// -------------------------------------------------------------
function attachDropzoneListeners() {
    document.querySelectorAll('.dropzone').forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('bg-teal-500/20');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('bg-teal-500/20');
        });

        zone.addEventListener('drop', async (e) => {
            e.preventDefault();
            zone.classList.remove('bg-teal-500/20');

            const dataStr = e.dataTransfer.getData('text/plain');
            if (!dataStr) return;

            try {
                const payload = JSON.parse(dataStr);
                const tanggal = zone.dataset.tanggal;
                const ruanganId = zone.dataset.ruanganId;

                const existing = state.jadwal_list.find(j => j.tanggal === tanggal && j.ruangan_id == ruanganId);

                let targetPegawaiId = existing ? existing.pegawai_id : (state.pegawai_list[0] ? state.pegawai_list[0].id : 1);
                let targetShiftId = existing ? existing.shift_id : (state.shift_list[0] ? state.shift_list[0].id : 1);

                if (payload.type === 'shift') {
                    targetShiftId = payload.id;
                } else if (payload.type === 'pegawai') {
                    targetPegawaiId = payload.id;
                }

                const res = await fetch('/api/jadwal/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tanggal: tanggal,
                        ruangan_id: parseInt(ruanganId),
                        pegawai_id: parseInt(targetPegawaiId),
                        shift_id: parseInt(targetShiftId)
                    })
                });

                const data = await res.json();
                if (data.status !== 'success') {
                    alert(data.message || 'Gagal mengubah jadwal');
                }

                loadDashboardData();
            } catch (err) {
                console.error("Drop handling error:", err);
            }
        });
    });
}

// -------------------------------------------------------------
// MODALS LOGIC
// -------------------------------------------------------------
function openCellModal(tanggal, ruanganId) {
    if (state.status_jadwal.status === 'FINAL') {
        alert('Jadwal sudah FINAL & terkunci oleh Kepala Puskesmas!');
        return;
    }

    state.selectedCell = { tanggal, ruangan_id: ruanganId };

    const ruangan = state.ruangan_list.find(r => r.id == ruanganId);
    document.getElementById('modal-cell-info').textContent = `${tanggal} | ${ruangan ? ruangan.nama : ''}`;

    const selectPegawai = document.getElementById('modal-cell-pegawai');
    selectPegawai.innerHTML = '';
    state.pegawai_list.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.nama} (${p.profesi})`;
        selectPegawai.appendChild(opt);
    });

    const selectShift = document.getElementById('modal-cell-shift');
    selectShift.innerHTML = '';
    state.shift_list.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.nama} (${s.kode}) - ${s.jam_masuk} s.d ${s.jam_keluar}`;
        selectShift.appendChild(opt);
    });

    const existing = state.jadwal_list.find(j => j.tanggal === tanggal && j.ruangan_id == ruanganId);
    if (existing) {
        selectPegawai.value = existing.pegawai_id;
        selectShift.value = existing.shift_id;
        document.getElementById('modal-cell-catatan').value = existing.catatan || '';
    } else {
        document.getElementById('modal-cell-catatan').value = '';
    }

    document.getElementById('modal-cell').classList.remove('hidden');
}

function closeCellModal() {
    document.getElementById('modal-cell').classList.add('hidden');
    state.selectedCell = null;
}

async function saveCellSchedule() {
    if (!state.selectedCell) return;

    const pegawaiId = document.getElementById('modal-cell-pegawai').value;
    const shiftId = document.getElementById('modal-cell-shift').value;
    const catatan = document.getElementById('modal-cell-catatan').value;

    const res = await fetch('/api/jadwal/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            tanggal: state.selectedCell.tanggal,
            ruangan_id: parseInt(state.selectedCell.ruangan_id),
            pegawai_id: parseInt(pegawaiId),
            shift_id: parseInt(shiftId),
            catatan: catatan
        })
    });

    const data = await res.json();
    if (data.status !== 'success') {
        alert(data.message || 'Gagal menyimpan jadwal');
    }

    closeCellModal();
    loadDashboardData();
}

async function deleteCellSchedule() {
    if (!state.selectedCell) return;

    const res = await fetch('/api/jadwal/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            tanggal: state.selectedCell.tanggal,
            ruangan_id: parseInt(state.selectedCell.ruangan_id)
        })
    });

    const data = await res.json();
    if (data.status !== 'success') {
        alert(data.message || 'Gagal menghapus jadwal');
    }

    closeCellModal();
    loadDashboardData();
}

// Bulk Modal Logic
function openBulkModal() {
    if (state.status_jadwal.status === 'FINAL') {
        alert('Jadwal sudah FINAL & terkunci oleh Kepala Puskesmas!');
        return;
    }

    const selectRuangan = document.getElementById('bulk-ruangan');
    selectRuangan.innerHTML = '';
    state.ruangan_list.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = `${r.nama} (${r.klaster})`;
        selectRuangan.appendChild(opt);
    });

    const selectPegawai = document.getElementById('bulk-pegawai');
    selectPegawai.innerHTML = '';
    state.pegawai_list.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.nama} (${p.profesi})`;
        selectPegawai.appendChild(opt);
    });

    const selectShift = document.getElementById('bulk-shift');
    selectShift.innerHTML = '';
    state.shift_list.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.nama} (${s.kode})`;
        selectShift.appendChild(opt);
    });

    document.getElementById('bulk-start-date').value = `${state.year}-${String(state.month).padStart(2, '0')}-01`;
    document.getElementById('bulk-end-date').value = `${state.year}-${String(state.month).padStart(2, '0')}-15`;

    document.getElementById('modal-bulk').classList.remove('hidden');
}

function closeBulkModal() {
    document.getElementById('modal-bulk').classList.add('hidden');
}

async function submitBulkMapping() {
    const startDate = document.getElementById('bulk-start-date').value;
    const endDate = document.getElementById('bulk-end-date').value;
    const ruanganId = document.getElementById('bulk-ruangan').value;
    const pegawaiId = document.getElementById('bulk-pegawai').value;
    const shiftId = document.getElementById('bulk-shift').value;

    if (!startDate || !endDate) return;

    const res = await fetch('/api/jadwal/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            start_date: startDate,
            end_date: endDate,
            ruangan_id: parseInt(ruanganId),
            pegawai_id: parseInt(pegawaiId),
            shift_id: parseInt(shiftId)
        })
    });

    const data = await res.json();
    if (data.status !== 'success') {
        alert(data.message || 'Gagal menerapkan bulk mapping');
    }

    closeBulkModal();
    loadDashboardData();
}

// Export Excel Handler
function exportExcel() {
    window.location.href = `/api/export/excel?year=${state.year}&month=${state.month}`;
}
