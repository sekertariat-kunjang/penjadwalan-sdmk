// Application Global State
const state = {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1, // bulan saat ini (1-12)
    num_days: 31,
    month_name: '',
    current_user: null, // { id, username, role, pegawai_id, pegawai_nama }
    status_jadwal: { status: 'DRAFT', approved_by: '', approved_at: '' },
    pegawai_list: [],
    ruangan_list: [],
    shift_list: [],
    jadwal_list: [],
    conflicts: [],
    selectedCell: null, // { tanggal, ruangan_id }
    selectedHarianDate: null,
    dragData: null, // { type: 'shift'|'pegawai', id: number }
    viewMode: 'compact', // 'compact' | 'detail'
    isSidebarOpen: true,
    activeKlasterFilter: 'ALL',
    collapsedKlaster: {}
};

const INDONESIAN_DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


function getStaffInitials(fullName) {
    if (!fullName) return '?';
    let cleanName = fullName
        .replace(/^(drg\.|dr\.|Bdn\.|Ns\.|apt\.)\s+/gi, '')
        .replace(/,\s*.*$/g, '')
        .trim();

    const parts = cleanName.split(/\s+/).filter(p => p.length > 0);
    if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
    } else if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return cleanName.substring(0, 2).toUpperCase();
}

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
            renderKlasterFilterChips();
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

        // Escape data dari server sebelum dimasukkan ke innerHTML (cegah XSS)
        const safeName = escapeHtml(u.pegawai_nama);
        const safeRole = escapeHtml(u.role.toUpperCase());

        container.innerHTML = `
            <div class="flex items-center gap-2">
                <div class="text-right hidden sm:block">
                    <span class="text-xs font-bold text-slate-200 block truncate max-w-[140px]">${safeName}</span>
                    <span class="text-[10px] px-1.5 py-0.2 rounded border font-semibold ${roleColor}">${safeRole}</span>
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

function openLoginModal() {
    const modal = document.getElementById('login-modal');
    if (!modal) return;

    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    if (usernameInput) usernameInput.value = '';
    if (passwordInput) passwordInput.value = '';

    const errBox = document.getElementById('login-error-msg');
    if (errBox) errBox.classList.add('hidden');

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function closeLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.classList.add('hidden');
}

async function quickLogin(role) {
    const username = role === 'kapus' ? 'kapus' : 'admin';
    const password = role === 'kapus' ? 'kapus123' : 'admin123';
    
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    if (usernameInput) usernameInput.value = username;
    if (passwordInput) passwordInput.value = password;

    await submitLogin(username, password);
}

async function handleLoginSubmit(e) {
    if (e) e.preventDefault();
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value.trim();
    await submitLogin(u, p);
}

async function submitLogin(username, password) {
    const errBox = document.getElementById('login-error-msg');
    const errText = document.getElementById('login-error-text');
    const btnSubmit = document.getElementById('btn-login-submit');

    if (errBox) errBox.classList.add('hidden');
    if (btnSubmit) btnSubmit.disabled = true;

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok && data.status === 'success') {
            closeLoginModal();
            await loadDashboardData();
        } else {
            if (errBox && errText) {
                errText.textContent = data.message || 'Username atau password salah!';
                errBox.classList.remove('hidden');
            }
        }
    } catch (err) {
        console.error("Login error:", err);
        if (errBox && errText) {
            errText.textContent = 'Terjadi kesalahan koneksi server.';
            errBox.classList.remove('hidden');
        }
    } finally {
        if (btnSubmit) btnSubmit.disabled = false;
    }
}

async function submitLogout() {
    try {
        const res = await fetch('/api/logout', { method: 'POST' });
        const data = await res.json();
        if (data.status === 'success') {
            state.current_user = null;
            await loadDashboardData();
        }
    } catch (err) {
        console.error("Logout error:", err);
    }
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
    const btnManageLayanan = document.getElementById('btn-manage-layanan');
    const btnImportExcel = document.getElementById('btn-import-excel');
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    const upperbarShiftPalette = document.getElementById('upperbar-shift-palette');

    const isLocked = state.status_jadwal.status === 'FINAL';
    const userRole = state.current_user ? state.current_user.role : null;
    const isPrivileged = (userRole === 'admin' || userRole === 'kapus') && !isLocked;

    if (!isPrivileged) {
        if (sidebar) {
            sidebar.classList.add('hidden');
            sidebar.classList.add('collapsed');
            state.isSidebarOpen = false;
        }
        if (btnToggleSidebar) btnToggleSidebar.classList.add('hidden');
        if (upperbarShiftPalette) upperbarShiftPalette.classList.add('hidden');
        if (btnManageLayanan) btnManageLayanan.classList.add('hidden');
        if (btnImportExcel) btnImportExcel.classList.add('hidden');
    } else {
        if (sidebar) {
            sidebar.classList.remove('hidden');
            sidebar.classList.remove('collapsed');
            state.isSidebarOpen = true;
        }
        if (btnToggleSidebar) btnToggleSidebar.classList.remove('hidden');
        if (upperbarShiftPalette) upperbarShiftPalette.classList.remove('hidden');
        if (btnManageLayanan) btnManageLayanan.classList.remove('hidden');
        if (btnImportExcel) btnImportExcel.classList.remove('hidden');
    }

    const icon = document.getElementById('icon-toggle-sidebar');
    if (icon) {
        icon.setAttribute('data-lucide', state.isSidebarOpen ? 'panel-left' : 'panel-left-open');
    }
    if (btnToggleSidebar) {
        if (state.isSidebarOpen) {
            btnToggleSidebar.classList.add('bg-teal-600/20', 'border-teal-500/50', 'text-teal-300');
            btnToggleSidebar.classList.remove('bg-slate-800');
        } else {
            btnToggleSidebar.classList.remove('bg-teal-600/20', 'border-teal-500/50', 'text-teal-300');
            btnToggleSidebar.classList.add('bg-slate-800');
        }
    }
    if (userRole === 'pegawai' && state.current_user && state.current_user.pegawai_id) {
        const selectDetail = document.getElementById('select-pegawai-detail');
        if (selectDetail) {
            selectDetail.value = state.current_user.pegawai_id;
        }
    }
    if (window.lucide) lucide.createIcons();
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
    if (!state.ruangan_list || state.ruangan_list.length === 0) {
        container.innerHTML = `<div class="p-3 text-center text-slate-500 italic">Belum ada layanan terdaftar</div>`;
        return;
    }

    state.ruangan_list.forEach(r => {
        const card = document.createElement('div');
        card.id = `ruang-card-${r.id}`;
        card.className = 'p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs hover:border-slate-700 transition gap-2';
        card.innerHTML = `
            <div>
                <span class="font-bold text-slate-200 block">${escapeHtml(r.nama)} (${escapeHtml(r.kode || '')})</span>
                <span class="text-[10px] text-teal-400 font-medium">${escapeHtml(r.klaster)} | Urutan: ${r.urutan}</span>
            </div>
            <div id="ruang-action-${r.id}">
                <button type="button" onclick="promptDeleteRuangan(${r.id})" class="px-3 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 text-[11px] font-bold border border-rose-800/80 transition cursor-pointer shadow">
                    Hapus
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

function promptDeleteRuangan(id) {
    const actionContainer = document.getElementById(`ruang-action-${id}`);
    if (!actionContainer) return;

    actionContainer.innerHTML = `
        <div class="flex items-center gap-1.5">
            <span class="text-[10px] text-rose-400 font-bold">Yakin?</span>
            <button type="button" onclick="executeDeleteRuangan(${id})" class="px-2 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] transition shadow">
                Ya, Hapus
            </button>
            <button type="button" onclick="renderRuanganManagerList()" class="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[10px] transition">
                Batal
            </button>
        </div>
    `;
}

async function executeDeleteRuangan(id) {
    const numericId = parseInt(id, 10);
    const actionContainer = document.getElementById(`ruang-action-${numericId}`);
    if (actionContainer) {
        actionContainer.innerHTML = `<span class="text-[10px] text-amber-400 font-semibold flex items-center gap-1"><i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> Menghapus...</span>`;
        if (window.lucide) lucide.createIcons();
    }

    try {
        const res = await fetch('/api/ruangan/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: numericId })
        });
        const data = await res.json();
        if (data.status === 'success') {
            await loadDashboardData();
            renderRuanganManagerList();
        } else {
            alert(data.message || 'Gagal menghapus layanan');
            renderRuanganManagerList();
        }
    } catch (err) {
        console.error("Delete ruangan error:", err);
        alert("Terjadi kesalahan sistem saat menghapus layanan.");
        renderRuanganManagerList();
    }
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
            await loadDashboardData();
            renderRuanganManagerList();
        } else {
            alert(data.message || 'Gagal menambah layanan');
        }
    } catch (err) {
        console.error("Add ruangan error:", err);
    }
}

// Backward compatibility wrapper
function deleteRuangan(id) {
    promptDeleteRuangan(id);
}

// Explicit window bindings
window.openRuanganModal = openRuanganModal;
window.closeRuanganModal = closeRuanganModal;
window.renderRuanganManagerList = renderRuanganManagerList;
window.saveNewRuangan = saveNewRuangan;
window.promptDeleteRuangan = promptDeleteRuangan;
window.executeDeleteRuangan = executeDeleteRuangan;
window.deleteRuangan = deleteRuangan;





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

// -------------------------------------------------------------
// UI WORKSPACE CONTROLS (UPPERBAR, SIDEBAR & TOOLTIPS)
// -------------------------------------------------------------
function toggleSidebar(forceState) {
    const sidebar = document.getElementById('sidebar-palette-container');
    const icon = document.getElementById('icon-toggle-sidebar');
    const btnToggle = document.getElementById('btn-toggle-sidebar');

    if (!sidebar) return;

    const isHiddenOrCollapsed = sidebar.classList.contains('hidden') || sidebar.classList.contains('collapsed');

    if (typeof forceState === 'boolean') {
        state.isSidebarOpen = forceState;
    } else {
        state.isSidebarOpen = isHiddenOrCollapsed;
    }

    if (state.isSidebarOpen) {
        sidebar.classList.remove('hidden');
        sidebar.classList.remove('collapsed');
        if (icon) icon.setAttribute('data-lucide', 'panel-left');
        if (btnToggle) {
            btnToggle.classList.add('bg-teal-600/20', 'border-teal-500/50', 'text-teal-300');
            btnToggle.classList.remove('bg-slate-800');
        }
    } else {
        sidebar.classList.add('collapsed');
        if (icon) icon.setAttribute('data-lucide', 'panel-left-open');
        if (btnToggle) {
            btnToggle.classList.remove('bg-teal-600/20', 'border-teal-500/50', 'text-teal-300');
            btnToggle.classList.add('bg-slate-800');
        }
    }
    if (window.lucide) lucide.createIcons();
}

function setViewMode(mode) {
    state.viewMode = mode;
    const btnCompact = document.getElementById('btn-mode-compact');
    const btnDetail = document.getElementById('btn-mode-detail');

    if (btnCompact && btnDetail) {
        if (mode === 'compact') {
            btnCompact.className = 'px-2.5 py-1 rounded-md font-bold text-[11px] flex items-center gap-1 bg-teal-600 text-white transition shadow';
            btnDetail.className = 'px-2.5 py-1 rounded-md font-medium text-[11px] flex items-center gap-1 text-slate-400 hover:text-slate-200 transition';
        } else {
            btnDetail.className = 'px-2.5 py-1 rounded-md font-bold text-[11px] flex items-center gap-1 bg-teal-600 text-white transition shadow';
            btnCompact.className = 'px-2.5 py-1 rounded-md font-medium text-[11px] flex items-center gap-1 text-slate-400 hover:text-slate-200 transition';
        }
    }

    renderMatrixKlaster();
}

function setKlasterFilter(klaster) {
    if (state.activeKlasterFilter === klaster) {
        state.activeKlasterFilter = 'ALL';
    } else {
        state.activeKlasterFilter = klaster;
    }
    renderKlasterFilterChips();
    renderMatrixKlaster();
}

function toggleKlasterAccordion(klasterName) {
    state.collapsedKlaster[klasterName] = !state.collapsedKlaster[klasterName];
    renderMatrixKlaster();
}

function renderKlasterFilterChips() {
    const container = document.getElementById('klaster-filter-chips');
    if (!container) return;

    const klasters = Array.from(new Set(state.ruangan_list.map(r => r.klaster)));

    let chipsHTML = `
        <button onclick="setKlasterFilter('ALL')" class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition ${state.activeKlasterFilter === 'ALL' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'}">
            Semua (${state.ruangan_list.length})
        </button>
    `;

    klasters.forEach(k => {
        const count = state.ruangan_list.filter(r => r.klaster === k).length;
        const isActive = state.activeKlasterFilter === k;
        let shortName = k.replace('Klaster ', 'K-');
        chipsHTML += `
            <button onclick="setKlasterFilter('${k}')" class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition whitespace-nowrap ${isActive ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'}">
                ${shortName} (${count})
            </button>
        `;
    });

    const isOffActive = state.activeKlasterFilter === 'LIBUR_CUTI';
    const offCount = state.jadwal_list.filter(j => ['L', 'C'].includes(j.shift_kode)).length;
    chipsHTML += `
        <button onclick="setKlasterFilter('LIBUR_CUTI')" class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition whitespace-nowrap ${isOffActive ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm' : 'bg-slate-900 text-amber-400 border border-slate-800 hover:text-amber-200'}" title="Filter Pegawai Libur (L) & Cuti (C)">
            🌴 Libur & Cuti (${offCount})
        </button>
    `;

    container.innerHTML = chipsHTML;
}

function showRichTooltip(e, inputData, tglStr, roomName) {
    const tooltip = document.getElementById('rich-tooltip');
    if (!tooltip) return;

    const listJ = Array.isArray(inputData) ? inputData : [inputData];
    if (listJ.length === 0) return;

    const badge = document.getElementById('tooltip-shift-badge');
    const dateEl = document.getElementById('tooltip-date');
    const nameEl = document.getElementById('tooltip-staff-name');
    const profesiEl = document.getElementById('tooltip-profesi');
    const roomEl = document.getElementById('tooltip-room');
    const noteEl = document.getElementById('tooltip-note');
    const noteContainer = document.getElementById('tooltip-note-container');

    if (dateEl) dateEl.textContent = `Tgl ${tglStr}`;
    
    if (listJ.length === 1 && ['L', 'C'].includes(listJ[0].shift_kode)) {
        if (roomEl) roomEl.textContent = 'Status Off (Tidak Dinas)';
    } else {
        if (roomEl) roomEl.textContent = roomName || '-';
    }

    if (listJ.length === 1) {
        const j = listJ[0];
        if (badge) {
            badge.textContent = `${j.shift_kode} (${j.shift_nama})`;
            badge.style.backgroundColor = j.warna_bg;
            badge.style.color = j.warna_text;
        }
        if (nameEl) nameEl.textContent = j.pegawai_nama || 'Pegawai';
        if (profesiEl) profesiEl.textContent = j.pegawai_profesi || 'SDMK';

        if (j.catatan) {
            if (noteEl) noteEl.textContent = j.catatan;
            if (noteContainer) noteContainer.classList.remove('hidden');
        } else {
            if (noteContainer) noteContainer.classList.add('hidden');
        }
    } else {
        if (badge) {
            badge.textContent = `${listJ.length} Petugas`;
            badge.style.backgroundColor = '#0d9488';
            badge.style.color = '#ffffff';
        }
        const staffListText = listJ.map(j => `<span class="block font-bold text-slate-100">• ${j.pegawai_nama} <span class="text-[10px] text-teal-400 font-normal">(${j.shift_kode} - ${j.shift_nama})</span></span>`).join('');
        if (nameEl) nameEl.innerHTML = staffListText;
        if (profesiEl) profesiEl.textContent = 'Multi Petugas Jaga';
        if (noteContainer) noteContainer.classList.add('hidden');
    }

    tooltip.classList.remove('hidden');
    moveRichTooltip(e);
}

function moveRichTooltip(e) {
    const tooltip = document.getElementById('rich-tooltip');
    if (!tooltip || tooltip.classList.contains('hidden')) return;

    const padding = 12;
    let left = e.clientX + padding;
    let top = e.clientY + padding;

    if (left + 240 > window.innerWidth) {
        left = e.clientX - 240 - padding;
    }
    if (top + 160 > window.innerHeight) {
        top = e.clientY - 160 - padding;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
}

function hideRichTooltip() {
    const tooltip = document.getElementById('rich-tooltip');
    if (tooltip) tooltip.classList.add('hidden');
}

// Render Master Shift Badges Palette in Sidebar & Upperbar
function renderShiftPalette() {
    const sidebarContainer = document.getElementById('shift-palette');
    const upperbarContainer = document.getElementById('upperbar-shift-palette');

    if (sidebarContainer) sidebarContainer.innerHTML = '';
    if (upperbarContainer) upperbarContainer.innerHTML = '';

    state.shift_list.forEach(s => {
        // Sidebar badge
        if (sidebarContainer) {
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
            sidebarContainer.appendChild(badge);
        }

        // Upperbar horizontal badge
        if (upperbarContainer) {
            const upBadge = document.createElement('div');
            upBadge.className = 'px-2 py-1 rounded-md text-center font-bold text-[11px] cursor-grab active:cursor-grabbing border border-white/10 shadow-sm transition hover:scale-105 select-none whitespace-nowrap flex items-center gap-1';
            upBadge.style.backgroundColor = s.warna_bg;
            upBadge.style.color = s.warna_text;
            upBadge.innerHTML = `<span class="opacity-80 text-[10px] font-normal">[${s.kode}]</span> <span>${s.nama}</span>`;
            upBadge.draggable = true;
            upBadge.addEventListener('dragstart', (e) => {
                state.dragData = { type: 'shift', id: s.id };
                e.dataTransfer.setData('text/plain', JSON.stringify(state.dragData));
            });
            upperbarContainer.appendChild(upBadge);
        }
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
    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.remove('hidden');

    const klasterFilterContainer = document.getElementById('klaster-filter-container');
    if (klasterFilterContainer) {
        if (tabId === 'tab-klaster') {
            klasterFilterContainer.classList.remove('hidden');
        } else {
            klasterFilterContainer.classList.add('hidden');
        }
    }

    renderActiveTab();
}

function renderActiveTab() {
    const isTabKlaster = !document.getElementById('tab-klaster').classList.contains('hidden');

    if (isTabKlaster) {
        renderMatrixKlaster();
    } else if (!document.getElementById('tab-profesi').classList.contains('hidden')) {
        renderMatrixProfesi();
    } else if (!document.getElementById('tab-harian').classList.contains('hidden')) {
        renderHarianTab();
    } else if (!document.getElementById('tab-pegawai').classList.contains('hidden')) {
        const selectDetail = document.getElementById('select-pegawai-detail');
        if (selectDetail && selectDetail.value) {
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

    if (!headerTr || !tbody) return;

    let headerHTML = `
        <th class="p-2 w-48 sticky-col-1 bg-slate-950 border-r border-slate-800 font-bold text-slate-200">Ruangan / Layanan</th>
    `;

    for (let day = 1; day <= state.num_days; day++) {
        const dateObj = new Date(state.year, state.month - 1, day);
        const dayIdx = dateObj.getDay();
        const dayName = INDONESIAN_DAYS[dayIdx === 0 ? 6 : dayIdx - 1];
        const isSunday = dayIdx === 0;

        headerHTML += `
            <th class="p-1.5 min-w-[54px] text-center border-r border-slate-800/60 font-semibold ${isSunday ? 'bg-rose-950/40 text-rose-400' : ''}" data-day="${day}">
                <span class="block text-[10px] text-slate-400">${dayName}</span>
                <span class="text-xs font-bold">${day}</span>
            </th>
        `;
    }
    headerTr.innerHTML = headerHTML;

    tbody.innerHTML = '';

    const scheduleMap = {};
    state.jadwal_list.forEach(j => {
        const k = `${j.ruangan_id}_${j.tanggal}`;
        if (!scheduleMap[k]) scheduleMap[k] = [];
        scheduleMap[k].push(j);
    });

    const isLocked = state.status_jadwal.status === 'FINAL';
    const userRole = state.current_user ? state.current_user.role : 'pegawai';

    let filteredRuangan = state.ruangan_list;
    if (state.activeKlasterFilter === 'LIBUR_CUTI') {
        const roomIdsWithOff = Array.from(new Set(state.jadwal_list.filter(j => ['L', 'C'].includes(j.shift_kode)).map(j => j.ruangan_id)));
        filteredRuangan = state.ruangan_list.filter(r => roomIdsWithOff.includes(r.id));
    } else if (state.activeKlasterFilter !== 'ALL') {
        filteredRuangan = state.ruangan_list.filter(r => r.klaster === state.activeKlasterFilter);
    }

    filteredRuangan.forEach(r => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/30 transition';

        let rowHTML = `
            <td class="p-2 sticky-col-1 bg-slate-900 border-r border-slate-800 font-bold text-slate-200">
                <span class="block text-xs text-slate-100 font-semibold truncate max-w-[170px]" title="${r.nama}">${r.nama}</span>
                <span class="text-[10px] text-teal-400 font-medium">${r.kode} <span class="text-slate-500 font-normal">| ${r.klaster}</span></span>
            </td>
        `;
        tr.innerHTML = rowHTML;

        for (let day = 1; day <= state.num_days; day++) {
            const tglStr = `${state.year}-${String(state.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const key = `${r.id}_${tglStr}`;
            // Room cells only display active duty shifts (P, S, M, ON). L & C statuses are tracked in bottom summary row.
            const listJ = (scheduleMap[key] || []).filter(j => !['L', 'C'].includes(j.shift_kode));

            let cellContent = '-';
            let staffTitle = '';

            if (listJ.length > 0) {
                const primaryJ = listJ[0];
                const primaryInitials = getStaffInitials(primaryJ.pegawai_nama);
                const staffFirstName = primaryJ.pegawai_nama ? primaryJ.pegawai_nama.split(' ')[0] : '';
                const isMulti = listJ.length > 1;
                const extraCount = listJ.length - 1;

                if (state.viewMode === 'compact') {
                    // Mode Ringkas: Staff Initials on Color-Coded Shift Background!
                    if (isMulti) {
                        cellContent = `
                            <div class="px-1.5 py-1 rounded-md text-xs font-black border-2 border-amber-400/80 shadow inline-flex items-center gap-1 transition hover:scale-105 select-none" style="background-color: ${primaryJ.warna_bg}; color: ${primaryJ.warna_text}" title="${primaryJ.pegawai_nama} (${primaryJ.shift_nama})">
                                <span>${primaryInitials}</span>
                                <span class="px-1 text-[9px] bg-amber-400 text-slate-950 font-black rounded-full shrink-0" title="${listJ.length} Petugas Jaga">+${extraCount}</span>
                            </div>
                        `;
                    } else {
                        cellContent = `
                            <div class="px-2 py-1 rounded-md text-xs font-black text-center border border-white/10 shadow transition hover:scale-105 inline-block select-none" style="background-color: ${primaryJ.warna_bg}; color: ${primaryJ.warna_text}" title="${primaryJ.pegawai_nama} (${primaryJ.shift_nama})">
                                <span>${primaryInitials}</span>
                            </div>
                        `;
                    }
                } else {
                    // Mode Detail: Main Title = Staff Name, Subtitle = Shift Name!
                    if (isMulti) {
                        cellContent = `
                            <div class="px-1.5 py-0.5 rounded-md text-xs font-bold border-2 border-amber-400/80 overflow-hidden shadow flex items-center justify-between gap-1 select-none" style="background-color: ${primaryJ.warna_bg}; color: ${primaryJ.warna_text}">
                                <div class="min-w-0 text-left">
                                    <span class="font-extrabold text-[11px] block truncate leading-tight">${staffFirstName}</span>
                                    <span class="block text-[9px] font-medium opacity-90 leading-tight">${primaryJ.shift_nama}</span>
                                </div>
                                <span class="px-1 text-[9px] bg-amber-400 text-slate-950 font-black rounded-full shrink-0" title="${listJ.length} Petugas Jaga">+${extraCount}</span>
                            </div>
                        `;
                    } else {
                        cellContent = `
                            <div class="px-1.5 py-0.5 rounded-md text-xs font-bold text-center border border-white/10 overflow-hidden shadow select-none" style="background-color: ${primaryJ.warna_bg}; color: ${primaryJ.warna_text}">
                                <span class="font-extrabold text-[11px] block truncate leading-tight">${staffFirstName}</span>
                                <span class="block text-[9px] font-medium opacity-90 leading-tight">${primaryJ.shift_nama}</span>
                            </div>
                        `;
                    }
                }
            }

            const canEdit = !isLocked && (userRole === 'admin' || userRole === 'kapus');
            const pointerClass = canEdit ? 'cursor-pointer hover:bg-teal-950/40 dropzone' : 'cursor-default';

            const cellTd = document.createElement('td');
            cellTd.className = `p-1 border-r border-b border-slate-800/40 text-center transition ${pointerClass}`;
            cellTd.setAttribute('data-tanggal', tglStr);
            cellTd.setAttribute('data-ruangan-id', r.id);
            cellTd.setAttribute('data-day', day);
            if (canEdit) cellTd.setAttribute('onclick', `openCellModal('${tglStr}', ${r.id})`);
            cellTd.innerHTML = cellContent;

            // Crosshair Hover Highlight & Rich Tooltip Handlers
            cellTd.addEventListener('mouseenter', (e) => {
                tr.classList.add('crosshair-row-active');

                const currentDay = day;
                document.querySelectorAll(`[data-day="${currentDay}"]`).forEach(el => {
                    el.classList.add('crosshair-col-active');
                });

                cellTd.classList.add('crosshair-cell-active');

                if (listJ.length > 0) {
                    showRichTooltip(e, listJ, tglStr, r.nama);
                }
            });

            cellTd.addEventListener('mousemove', (e) => {
                if (listJ.length > 0) moveRichTooltip(e);
            });

            cellTd.addEventListener('mouseleave', () => {
                tr.classList.remove('crosshair-row-active');
                document.querySelectorAll('.crosshair-col-active').forEach(el => {
                    el.classList.remove('crosshair-col-active');
                });
                cellTd.classList.remove('crosshair-cell-active');
                hideRichTooltip();
            });

            tr.appendChild(cellTd);
        }

        tbody.appendChild(tr);
    });

    // -------------------------------------------------------------
    // BOTTOM SUMMARY ROW FOR LIBUR & CUTI (SHIFT L & C)
    // -------------------------------------------------------------
    const summaryTr = document.createElement('tr');
    summaryTr.className = 'bg-slate-950 border-t-2 border-slate-700/80 font-bold hover:bg-slate-900/60 transition';

    let summaryRowHTML = `
        <td class="p-2 sticky-col-1 bg-slate-950 border-r border-slate-800 font-bold text-amber-400">
            <span class="flex items-center gap-1.5 text-xs">
                <i data-lucide="palmtree" class="w-4 h-4 text-emerald-400"></i>
                Pegawai Libur / Cuti
            </span>
            <span class="text-[10px] text-slate-400 font-normal">Rekap Staf Shift L & C Harian</span>
        </td>
    `;
    summaryTr.innerHTML = summaryRowHTML;

    for (let day = 1; day <= state.num_days; day++) {
        const tglStr = `${state.year}-${String(state.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // Query off/leave staff on this date
        const offJadwals = state.jadwal_list.filter(j => j.tanggal === tglStr && ['L', 'C'].includes(j.shift_kode));

        let cellContent = '-';
        if (offJadwals.length > 0) {
            const primaryOff = offJadwals[0];
            const isMultiOff = offJadwals.length > 1;
            const extraOff = offJadwals.length - 1;
            const staffFirstName = primaryOff.pegawai_nama ? primaryOff.pegawai_nama.split(' ')[0] : '';

            if (isMultiOff) {
                cellContent = `
                    <div class="px-1.5 py-0.5 rounded-md text-xs font-bold border-2 border-emerald-400/70 overflow-hidden shadow flex items-center justify-between gap-1 select-none" style="background-color: ${primaryOff.warna_bg}; color: ${primaryOff.warna_text}">
                        <div class="min-w-0 text-left">
                            <span class="font-extrabold text-[11px] block truncate leading-tight">${staffFirstName}</span>
                            <span class="block text-[9px] font-medium opacity-90 leading-tight">${primaryOff.shift_nama}</span>
                        </div>
                        <span class="px-1 text-[9px] bg-emerald-400 text-slate-950 font-black rounded-full shrink-0">+${extraOff}</span>
                    </div>
                `;
            } else {
                cellContent = `
                    <div class="px-1.5 py-0.5 rounded-md text-xs font-bold text-center border border-white/10 overflow-hidden shadow select-none" style="background-color: ${primaryOff.warna_bg}; color: ${primaryOff.warna_text}">
                        <span class="font-extrabold text-[11px] block truncate leading-tight">${staffFirstName}</span>
                        <span class="block text-[9px] font-medium opacity-90 leading-tight">${primaryOff.shift_nama}</span>
                    </div>
                `;
            }
        }

        const cellTd = document.createElement('td');
        cellTd.className = 'p-1 border-r border-b border-slate-800/60 text-center bg-slate-950/90';
        cellTd.setAttribute('data-day', day);
        cellTd.innerHTML = cellContent;

        if (offJadwals.length > 0) {
            cellTd.addEventListener('mouseenter', (e) => {
                summaryTr.classList.add('crosshair-row-active');
                const currentDay = day;
                document.querySelectorAll(`[data-day="${currentDay}"]`).forEach(el => el.classList.add('crosshair-col-active'));
                cellTd.classList.add('crosshair-cell-active');
                showRichTooltip(e, offJadwals, tglStr, 'Daftar Pegawai Libur / Cuti');
            });
            cellTd.addEventListener('mousemove', (e) => moveRichTooltip(e));
            cellTd.addEventListener('mouseleave', () => {
                summaryTr.classList.remove('crosshair-row-active');
                document.querySelectorAll('.crosshair-col-active').forEach(el => el.classList.remove('crosshair-col-active'));
                cellTd.classList.remove('crosshair-cell-active');
                hideRichTooltip();
            });
        }

        summaryTr.appendChild(cellTd);
    }

    tbody.appendChild(summaryTr);

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

    if (!headerTr || !tbody) return;

    let headerHTML = `
        <th class="p-2 w-52 sticky-col-1 bg-slate-950 border-r border-slate-800 font-bold text-slate-200">Nama Pegawai & Profesi</th>
    `;

    for (let day = 1; day <= state.num_days; day++) {
        const dateObj = new Date(state.year, state.month - 1, day);
        const dayIdx = dateObj.getDay();
        const dayName = INDONESIAN_DAYS[dayIdx === 0 ? 6 : dayIdx - 1];
        const isSunday = dayIdx === 0;
        headerHTML += `
            <th class="p-1.5 min-w-[54px] text-center border-r border-slate-800/60 font-semibold ${isSunday ? 'bg-rose-950/40 text-rose-400' : ''}" data-day="${day}">
                <span class="block text-[10px] text-slate-400">${dayName}</span>
                <span class="text-xs font-bold">${day}</span>
            </th>
        `;
    }
    headerTr.innerHTML = headerHTML;

    tbody.innerHTML = '';
    let currentProfesi = null;

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
            const countInProfesi = state.pegawai_list.filter(pg => pg.profesi === currentProfesi).length;
            groupTr.innerHTML = `
                <td colspan="${state.num_days + 1}" class="p-2 text-xs uppercase tracking-wider pl-4">
                    <i data-lucide="user-check" class="w-3.5 h-3.5 inline mr-1 text-teal-400"></i>
                    Profesi: ${currentProfesi} (${countInProfesi} Pegawai)
                </td>
            `;
            tbody.appendChild(groupTr);
        }

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/30 transition';

        let rowHTML = `
            <td class="p-2 sticky-col-1 bg-slate-900 border-r border-slate-800 font-bold text-slate-200">
                <span class="block text-xs font-semibold text-slate-100 truncate max-w-[190px]" title="${p.nama}">${p.nama}</span>
                <span class="text-[10px] text-teal-400 font-normal">${p.profesi}</span>
            </td>
        `;
        tr.innerHTML = rowHTML;

        for (let day = 1; day <= state.num_days; day++) {
            const tglStr = `${state.year}-${String(state.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const listJ = pegawaiJadwalMap[`${p.id}_${tglStr}`] || [];

            let cellContent = '-';
            if (listJ.length > 0) {
                cellContent = listJ.map(j => {
                    const isOff = ['L', 'C'].includes(j.shift_kode);
                    const roomShort = isOff ? '' : (j.ruangan_nama && j.ruangan_nama !== '-' ? j.ruangan_nama.split(' ')[0] : '');
                    const titleText = isOff ? `${j.shift_nama}` : `${j.shift_nama} di ${j.ruangan_nama}`;
                    return `
                        <div class="px-1 py-0.5 rounded text-[10px] font-bold text-center border border-white/10 shadow-sm transition hover:scale-105 select-none my-0.5" style="background-color: ${j.warna_bg}; color: ${j.warna_text}" title="${titleText}">
                            <span>${j.shift_kode}</span>
                            ${roomShort ? `<span class="block text-[8px] font-normal opacity-90 truncate max-w-[44px] mx-auto">${roomShort}</span>` : ''}
                        </div>
                    `;
                }).join('');
            }

            const cellTd = document.createElement('td');
            cellTd.className = 'p-1 border-r border-b border-slate-800/40 text-center';
            cellTd.setAttribute('data-day', day);
            cellTd.innerHTML = cellContent;

            if (listJ.length > 0) {
                cellTd.addEventListener('mouseenter', (e) => {
                    tr.classList.add('crosshair-row-active');
                    const currentDay = day;
                    document.querySelectorAll(`[data-day="${currentDay}"]`).forEach(el => el.classList.add('crosshair-col-active'));
                    cellTd.classList.add('crosshair-cell-active');
                    showRichTooltip(e, listJ, tglStr, `Petugas: ${p.nama}`);
                });
                cellTd.addEventListener('mousemove', (e) => moveRichTooltip(e));
                cellTd.addEventListener('mouseleave', () => {
                    tr.classList.remove('crosshair-row-active');
                    document.querySelectorAll('.crosshair-col-active').forEach(el => el.classList.remove('crosshair-col-active'));
                    cellTd.classList.remove('crosshair-cell-active');
                    hideRichTooltip();
                });
            }

            tr.appendChild(cellTd);
        }

        tbody.appendChild(tr);
    });

    if (window.lucide) lucide.createIcons();
}

// -------------------------------------------------------------
// TAB 3: View Harian / Mobile Card View
// -------------------------------------------------------------
function navigateHarianDate(offset) {
    if (!state.selectedHarianDate) {
        state.selectedHarianDate = `${state.year}-${String(state.month).padStart(2, '0')}-01`;
    }
    const currentDay = parseInt(state.selectedHarianDate.split('-')[2]);
    let newDay = currentDay + offset;
    if (newDay < 1) newDay = 1;
    if (newDay > state.num_days) newDay = state.num_days;

    state.selectedHarianDate = `${state.year}-${String(state.month).padStart(2, '0')}-${String(newDay).padStart(2, '0')}`;
    renderHarianTab();
}

function renderHarianTab() {
    const carousel = document.getElementById('harian-date-carousel');
    if (!carousel) return;
    carousel.innerHTML = '';

    if (!state.selectedHarianDate) {
        state.selectedHarianDate = `${state.year}-${String(state.month).padStart(2, '0')}-01`;
    }

    for (let day = 1; day <= state.num_days; day++) {
        const tglStr = `${state.year}-${String(state.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isSelected = tglStr === state.selectedHarianDate;

        const pill = document.createElement('button');
        pill.className = `px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition ${isSelected ? 'bg-teal-600 text-white shadow-md shadow-teal-900/40 border border-teal-400' : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'}`;
        pill.textContent = `Tgl ${day}`;
        pill.id = `harian-pill-${day}`;
        pill.onclick = () => {
            state.selectedHarianDate = tglStr;
            renderHarianTab();
        };

        carousel.appendChild(pill);
    }

    // Auto-scroll selected pill into view
    const selectedPill = document.getElementById(`harian-pill-${parseInt(state.selectedHarianDate.split('-')[2])}`);
    if (selectedPill && carousel) {
        selectedPill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    renderHarianCards(state.selectedHarianDate);
}

function renderHarianCards(dateStr) {
    const container = document.getElementById('harian-cards-container');
    if (!container) return;
    container.innerHTML = '';

    const dayJadwals = state.jadwal_list.filter(j => j.tanggal === dateStr);
    const dayJadwalMap = {};
    dayJadwals.forEach(j => {
        if (!dayJadwalMap[j.ruangan_id]) dayJadwalMap[j.ruangan_id] = [];
        dayJadwalMap[j.ruangan_id].push(j);
    });

    const isLocked = state.status_jadwal.status === 'FINAL';
    const userRole = state.current_user ? state.current_user.role : 'pegawai';

    state.ruangan_list.forEach(r => {
        const card = document.createElement('div');
        card.className = 'bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-lg hover:border-slate-700 transition';

        const listJ = dayJadwalMap[r.id] || [];
        const activeDutyList = listJ.filter(j => !['L', 'C'].includes(j.shift_kode));

        let shiftBadgeHTML = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-500">Tutup / Tidak Ada Dinas</span>`;
        let staffContentHTML = '';

        if (activeDutyList.length > 0) {
            const primaryJ = activeDutyList[0];
            shiftBadgeHTML = `
                <span class="px-2 py-0.5 rounded-lg text-[11px] font-extrabold border border-white/10 shadow-sm" style="background-color: ${primaryJ.warna_bg}; color: ${primaryJ.warna_text}">
                    Shift ${primaryJ.shift_kode} (${primaryJ.shift_nama})
                </span>
            `;

            staffContentHTML = activeDutyList.map(j => `
                <div class="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800/80 my-1">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <div class="w-7 h-7 rounded-full bg-teal-950 border border-teal-800 flex items-center justify-center text-teal-400 font-bold text-[11px] shrink-0">
                            ${getStaffInitials(j.pegawai_nama)}
                        </div>
                        <div class="min-w-0">
                            <span class="text-xs font-bold text-slate-200 block truncate">${j.pegawai_nama}</span>
                            <span class="text-[10px] text-teal-400 font-medium">${j.pegawai_profesi || 'SDMK'}</span>
                        </div>
                    </div>
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold border border-white/10 shrink-0" style="background-color: ${j.warna_bg}; color: ${j.warna_text}">
                        ${j.shift_kode}
                    </span>
                </div>
            `).join('');
        } else {
            staffContentHTML = `
                <div class="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800 text-center text-slate-500 text-xs italic my-1">
                    Belum ada pegawai bertugas di layanan ini.
                </div>
            `;
        }

        const editBtnHTML = (!isLocked && (userRole === 'admin' || userRole === 'kapus')) ? `
            <button onclick="openCellModal('${dateStr}', ${r.id})" class="mt-2 w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition text-center flex items-center justify-center gap-1">
                <i data-lucide="edit-3" class="w-3.5 h-3.5 text-teal-400"></i>
                Kelola Petugas Layanan
            </button>
        ` : '';

        card.innerHTML = `
            <div>
                <div class="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2 mb-2">
                    <div>
                        <h4 class="text-xs font-bold text-slate-100">${r.nama}</h4>
                        <span class="text-[10px] text-teal-400 font-medium">${r.klaster}</span>
                    </div>
                    ${shiftBadgeHTML}
                </div>
                <div class="space-y-1">
                    ${staffContentHTML}
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
    if (!selectDetail) return;
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

function navigatePegawaiDetail(offset) {
    const selectDetail = document.getElementById('select-pegawai-detail');
    if (!selectDetail || state.pegawai_list.length === 0) return;

    const currentIndex = state.pegawai_list.findIndex(p => p.id == selectDetail.value);
    let newIndex = currentIndex + offset;
    if (newIndex < 0) newIndex = state.pegawai_list.length - 1;
    if (newIndex >= state.pegawai_list.length) newIndex = 0;

    const newPegawaiId = state.pegawai_list[newIndex].id;
    selectDetail.value = newPegawaiId;
    renderPegawaiDetail(newPegawaiId);
}

function renderPegawaiDetail(pegawaiId) {
    if (!pegawaiId) return;

    const peg = state.pegawai_list.find(p => p.id == pegawaiId);
    if (!peg) return;

    document.getElementById('pegawai-detail-name').textContent = peg.nama;
    document.getElementById('pegawai-detail-nip').textContent = `NIP: ${peg.nip || '-'} | Profesi: ${peg.profesi}`;

    const staffJadwals = state.jadwal_list.filter(j => j.pegawai_id == pegawaiId);

    let countPagi = 0, countSiang = 0, countMalam = 0, countLibur = 0;
    const dateJadwalsMap = {};

    staffJadwals.forEach(j => {
        if (!dateJadwalsMap[j.tanggal]) dateJadwalsMap[j.tanggal] = [];
        dateJadwalsMap[j.tanggal].push(j);

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
    if (!calGrid) return;
    calGrid.innerHTML = '';

    // Calendar Day Headers
    INDONESIAN_DAYS.forEach(d => {
        const dh = document.createElement('div');
        dh.className = 'font-bold text-[11px] text-slate-400 py-1 border-b border-slate-800';
        dh.textContent = d;
        calGrid.appendChild(dh);
    });

    // Calendar First Day Offset (Mon = 0, Tue = 1 ... Sun = 6)
    const firstDate = new Date(state.year, state.month - 1, 1);
    let firstDayIdx = firstDate.getDay(); // 0 = Sun, 1 = Mon ...
    let offsetDays = firstDayIdx === 0 ? 6 : firstDayIdx - 1;

    for (let i = 0; i < offsetDays; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'bg-slate-950/30 border border-slate-800/30 rounded-lg p-2 h-16 opacity-30';
        calGrid.appendChild(emptyCell);
    }

    // Days 1 to num_days
    for (let day = 1; day <= state.num_days; day++) {
        const tglStr = `${state.year}-${String(state.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayJadwals = dateJadwalsMap[tglStr] || [];

        const cell = document.createElement('div');
        cell.className = 'bg-slate-900/60 border border-slate-800 rounded-lg p-1.5 flex flex-col justify-between h-16 transition hover:border-teal-500/50';

        let badgeHTML = `<span class="text-[10px] text-slate-600 font-medium text-center block opacity-60">-</span>`;
        if (dayJadwals.length > 0) {
            badgeHTML = dayJadwals.map(j => {
                const isOff = ['L', 'C'].includes(j.shift_kode);
                const roomShort = isOff ? '' : (j.ruangan_nama && j.ruangan_nama !== '-' ? j.ruangan_nama.split(' ')[0] : '');
                const labelText = isOff ? `${j.shift_kode} (${j.shift_nama})` : `${j.shift_kode} - ${roomShort}`;
                const titleText = isOff ? `${j.shift_nama}` : `${j.shift_nama} di ${j.ruangan_nama}`;
                return `
                    <div class="px-1 py-0.5 rounded text-[9px] font-bold w-full truncate border border-white/10 text-center my-0.5 shadow-sm" style="background-color: ${j.warna_bg}; color: ${j.warna_text}" title="${titleText}">
                        ${labelText}
                    </div>
                `;
            }).join('');
        }

        cell.innerHTML = `
            <span class="text-xs font-bold text-slate-300 self-start">${day}</span>
            <div class="w-full flex-1 flex flex-col justify-center min-h-0">${badgeHTML}</div>
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
// -------------------------------------------------------------
// MODALS LOGIC (MULTI-STAFF SUPPORTED)
// -------------------------------------------------------------
function updateModalPegawaiDropdown(currentEditingPegawaiId = null) {
    const selectPegawai = document.getElementById('modal-cell-pegawai');
    if (!selectPegawai || !state.selectedCell) return;

    const { tanggal } = state.selectedCell;

    // Get IDs of all staff assigned on this date across ALL rooms
    const assignedStaffIds = state.jadwal_list
        .filter(j => j.tanggal === tanggal)
        .map(j => j.pegawai_id);

    // Filter available staff: not assigned on this date OR matches currentEditingPegawaiId
    const availableStaff = state.pegawai_list.filter(p => {
        if (currentEditingPegawaiId && p.id == currentEditingPegawaiId) return true;
        return !assignedStaffIds.includes(p.id);
    });

    selectPegawai.innerHTML = '';

    if (availableStaff.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '-- Semua pegawai sudah ditugaskan pada tanggal ini --';
        selectPegawai.appendChild(opt);
        selectPegawai.disabled = true;
    } else {
        selectPegawai.disabled = false;
        availableStaff.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.nama} (${p.profesi})`;
            if (currentEditingPegawaiId && p.id == currentEditingPegawaiId) {
                opt.selected = true;
            }
            selectPegawai.appendChild(opt);
        });
    }
}

function openCellModal(tanggal, ruanganId) {
    const isLocked = state.status_jadwal.status === 'FINAL';
    const userRole = state.current_user ? state.current_user.role : null;
    if (!userRole || (userRole !== 'admin' && userRole !== 'kapus')) {
        return; // Visitors & pegawai cannot open edit modal
    }
    if (isLocked) {
        alert('Jadwal bulan ini sudah FINAL & terkunci oleh Kepala Puskesmas!');
        return;
    }

    state.selectedCell = { tanggal: tanggal, ruangan_id: parseInt(ruanganId) };

    const ruangan = state.ruangan_list.find(r => r.id == ruanganId);
    const infoDiv = document.getElementById('modal-cell-info');
    if (infoDiv) {
        infoDiv.textContent = `${ruangan ? ruangan.nama : 'Layanan'} (${ruangan ? ruangan.kode : ''}) - Tanggal: ${tanggal}`;
    }

    // Populate Select Shift
    const selectShift = document.getElementById('modal-cell-shift');
    if (selectShift) {
        selectShift.innerHTML = '';
        state.shift_list.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = `${s.nama} (${s.kode}) - ${s.jam_masuk || ''} s.d ${s.jam_keluar || ''}`;
            selectShift.appendChild(opt);
        });
    }

    renderCellAssignedList();
    resetCellForm();

    document.getElementById('modal-cell').classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function closeCellModal() {
    document.getElementById('modal-cell').classList.add('hidden');
    state.selectedCell = null;
}

function renderCellAssignedList() {
    const listContainer = document.getElementById('modal-cell-assigned-list');
    if (!listContainer || !state.selectedCell) return;

    const { tanggal, ruangan_id } = state.selectedCell;
    const assigned = state.jadwal_list.filter(j => j.ruangan_id == ruangan_id && j.tanggal === tanggal);

    listContainer.innerHTML = '';

    if (assigned.length === 0) {
        listContainer.innerHTML = `
            <div class="p-2 text-center text-xs text-slate-500 italic bg-slate-950/40 rounded-lg border border-slate-800">
                Belum ada petugas bertugas di layanan ini pada tanggal tersebut.
            </div>
        `;
        return;
    }

    assigned.forEach(j => {
        const item = document.createElement('div');
        item.className = 'p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs gap-2';
        
        const noteText = j.catatan ? `<span class="text-slate-400 block text-[10px] italic">Catatan: ${j.catatan}</span>` : '';

        item.innerHTML = `
            <div class="flex items-center gap-2 min-w-0">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold shrink-0 shadow-sm" style="background-color: ${j.warna_bg}; color: ${j.warna_text}">
                    ${j.shift_kode}
                </span>
                <div class="min-w-0">
                    <span class="font-bold text-slate-200 block truncate text-[11px]">${j.pegawai_nama}</span>
                    <span class="text-[10px] text-teal-400 font-medium block">${j.pegawai_profesi || 'SDMK'}</span>
                    ${noteText}
                </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
                <button onclick="editAssignmentInModal(${j.id}, ${j.pegawai_id}, ${j.shift_id}, '${(j.catatan || '').replace(/'/g, "\\'")}')" class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 text-[10px] font-semibold transition border border-slate-700">
                    Edit
                </button>
                <button onclick="deleteAssignmentById(${j.id})" class="px-2 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 text-[10px] font-semibold border border-rose-800 transition">
                    Hapus
                </button>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

function editAssignmentInModal(id, pegawai_id, shift_id, catatan) {
    document.getElementById('modal-cell-jadwal-id').value = id;
    document.getElementById('modal-cell-shift').value = shift_id;
    document.getElementById('modal-cell-catatan').value = catatan || '';
    
    updateModalPegawaiDropdown(pegawai_id);

    document.getElementById('modal-form-title').textContent = '✏️ Edit Penugasan Pegawai';
    document.getElementById('btn-cancel-edit-assignment').classList.remove('hidden');
    
    const errDiv = document.getElementById('modal-cell-error');
    if (errDiv) errDiv.classList.add('hidden');
}

function resetCellForm() {
    document.getElementById('modal-cell-jadwal-id').value = '';
    document.getElementById('modal-cell-catatan').value = '';
    document.getElementById('modal-form-title').textContent = '+ Tambah Penugasan Pegawai';
    document.getElementById('btn-cancel-edit-assignment').classList.add('hidden');
    
    updateModalPegawaiDropdown(null);

    const errDiv = document.getElementById('modal-cell-error');
    if (errDiv) errDiv.classList.add('hidden');
}

async function saveCellSchedule() {
    if (!state.selectedCell) return;
    
    const jadwal_id = document.getElementById('modal-cell-jadwal-id').value;
    const pegawai_id = parseInt(document.getElementById('modal-cell-pegawai').value);
    const shift_id = parseInt(document.getElementById('modal-cell-shift').value);
    const catatan = document.getElementById('modal-cell-catatan').value.trim();
    
    const errDiv = document.getElementById('modal-cell-error');
    const errMsg = document.getElementById('modal-cell-error-msg');

    if (!pegawai_id || !shift_id) {
        if (errMsg) errMsg.textContent = 'Harap pilih pegawai dan shift!';
        if (errDiv) errDiv.classList.remove('hidden');
        return;
    }

    const payload = {
        tanggal: state.selectedCell.tanggal,
        ruangan_id: state.selectedCell.ruangan_id,
        pegawai_id: pegawai_id,
        shift_id: shift_id,
        catatan: catatan
    };

    if (jadwal_id) {
        payload.jadwal_id = parseInt(jadwal_id);
    }

    try {
        const res = await fetch('/api/jadwal/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.status === 'success') {
            resetCellForm();
            await loadDashboardData();
            renderCellAssignedList();
        } else {
            if (errMsg) errMsg.textContent = data.message || 'Gagal menyimpan penugasan!';
            if (errDiv) errDiv.classList.remove('hidden');
        }
    } catch (err) {
        console.error("Save cell schedule error:", err);
        if (errMsg) errMsg.textContent = 'Terjadi kesalahan koneksi server!';
        if (errDiv) errDiv.classList.remove('hidden');
    }
}

async function deleteAssignmentById(jadwal_id) {
    if (!confirm('Apakah Anda yakin ingin menghapus penugasan ini?')) return;

    try {
        const res = await fetch('/api/jadwal/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jadwal_id: jadwal_id })
        });
        const data = await res.json();
        if (data.status === 'success') {
            await loadDashboardData();
            renderCellAssignedList();
        } else {
            alert(data.message || 'Gagal menghapus penugasan');
        }
    } catch (err) {
        console.error("Delete assignment error:", err);
    }
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

// -------------------------------------------------------------
// MANAGE PEGAWAI & EXCEL IMPORT HANDLERS (UNIFIED 2-TAB MODAL)
// -------------------------------------------------------------
function openPegawaiModal(defaultTab = 'individu') {
    switchPegawaiTab(defaultTab);
    const modal = document.getElementById('modal-manage-pegawai');
    if (modal) modal.classList.remove('hidden');
}

function closePegawaiModal() {
    const modal = document.getElementById('modal-manage-pegawai');
    if (modal) modal.classList.add('hidden');
}

function openImportModal() {
    openPegawaiModal('bulk');
}

function closeImportModal() {
    closePegawaiModal();
}

function switchPegawaiTab(tabName) {
    const btnIndividu = document.getElementById('tab-peg-btn-individu');
    const btnBulk = document.getElementById('tab-peg-btn-bulk');
    const contentIndividu = document.getElementById('tab-peg-content-individu');
    const contentBulk = document.getElementById('tab-peg-content-bulk');

    if (tabName === 'bulk') {
        if (btnBulk) btnBulk.className = 'flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border transition cursor-pointer bg-teal-950/80 text-teal-300 border-teal-700/80 shadow';
        if (btnIndividu) btnIndividu.className = 'flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border transition cursor-pointer bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700';
        if (contentBulk) contentBulk.classList.remove('hidden');
        if (contentIndividu) contentIndividu.classList.add('hidden');
    } else {
        if (btnIndividu) btnIndividu.className = 'flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border transition cursor-pointer bg-teal-950/80 text-teal-300 border-teal-700/80 shadow';
        if (btnBulk) btnBulk.className = 'flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border transition cursor-pointer bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700';
        if (contentIndividu) contentIndividu.classList.remove('hidden');
        if (contentBulk) contentBulk.classList.add('hidden');

        resetPegawaiForm();
        renderPegawaiTable();
    }
    if (window.lucide) lucide.createIcons();
}

function resetPegawaiForm() {
    const idInput = document.getElementById('pegawai-form-id');
    const namaInput = document.getElementById('pegawai-form-nama');
    const profesiInput = document.getElementById('pegawai-form-profesi');
    const nipInput = document.getElementById('pegawai-form-nip');
    const nohpInput = document.getElementById('pegawai-form-nohp');

    if (idInput) idInput.value = '';
    if (namaInput) namaInput.value = '';
    if (profesiInput) profesiInput.value = '';
    if (nipInput) nipInput.value = '';
    if (nohpInput) nohpInput.value = '';

    const title = document.getElementById('pegawai-form-title');
    if (title) {
        title.innerHTML = `<span class="flex items-center gap-1.5"><i data-lucide="user-plus" class="w-4 h-4"></i> Tambah Pegawai Baru</span>`;
    }

    const btnSave = document.getElementById('btn-save-pegawai-form');
    if (btnSave) {
        btnSave.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5"></i> Simpan Pegawai`;
        btnSave.className = 'px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition shadow flex items-center gap-1.5';
    }

    const btnCancel = document.getElementById('btn-cancel-pegawai-form');
    if (btnCancel) {
        btnCancel.innerText = 'Reset Form';
    }

    if (window.lucide) lucide.createIcons();
}

function editPegawaiForm(id) {
    const p = (state.pegawai_list || []).find(x => x.id === id);
    if (!p) return;

    document.getElementById('pegawai-form-id').value = p.id;
    document.getElementById('pegawai-form-nama').value = p.nama;
    document.getElementById('pegawai-form-profesi').value = p.profesi;
    document.getElementById('pegawai-form-nip').value = p.nip === '-' ? '' : p.nip;
    document.getElementById('pegawai-form-nohp').value = p.no_hp === '-' ? '' : p.no_hp;

    const title = document.getElementById('pegawai-form-title');
    if (title) {
        title.innerHTML = `<span class="flex items-center gap-1.5 text-amber-300"><i data-lucide="edit-3" class="w-4 h-4 text-amber-400"></i> Edit Data Pegawai: <span class="text-slate-100 font-bold">${escapeHtml(p.nama)}</span></span>`;
    }

    const btnSave = document.getElementById('btn-save-pegawai-form');
    if (btnSave) {
        btnSave.innerHTML = `<i data-lucide="check-circle" class="w-3.5 h-3.5"></i> Simpan Perubahan`;
        btnSave.className = 'px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition shadow flex items-center gap-1.5';
    }

    const btnCancel = document.getElementById('btn-cancel-pegawai-form');
    if (btnCancel) {
        btnCancel.innerText = 'Batal Edit';
    }

    if (window.lucide) lucide.createIcons();
}

function renderPegawaiTable(filterText = '') {
    const tbody = document.getElementById('pegawai-table-body');
    if (!tbody) return;

    let list = state.pegawai_list || [];
    if (filterText.trim()) {
        const query = filterText.toLowerCase();
        list = list.filter(p => p.nama.toLowerCase().includes(query) || p.profesi.toLowerCase().includes(query) || (p.nip && p.nip.includes(query)));
    }

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-500 italic">Tidak ada data pegawai ditemukan</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(p => `
        <tr class="hover:bg-slate-900/80 transition" id="pegawai-row-${p.id}">
            <td class="p-2.5 font-bold text-slate-200">${escapeHtml(p.nama)}</td>
            <td class="p-2.5 text-teal-400 font-medium">${escapeHtml(p.profesi)}</td>
            <td class="p-2.5 font-mono text-[11px] text-slate-400">${escapeHtml(p.nip || '-')}</td>
            <td class="p-2.5 text-right">
                <span id="pegawai-action-${p.id}" class="inline-flex items-center gap-1.5">
                    <button type="button" onclick="editPegawaiForm(${p.id})" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg text-[10px] font-bold border border-slate-700 transition cursor-pointer">
                        Edit
                    </button>
                    <button type="button" onclick="promptDeletePegawai(${p.id})" class="px-2.5 py-1 bg-rose-950/80 hover:bg-rose-900 text-rose-300 rounded-lg text-[10px] font-bold border border-rose-800 transition cursor-pointer">
                        Hapus
                    </button>
                </span>
            </td>
        </tr>
    `).join('');
}

function filterPegawaiTable() {
    const val = document.getElementById('pegawai-search-input').value;
    renderPegawaiTable(val);
}

async function savePegawai() {
    const id = document.getElementById('pegawai-form-id').value;
    const nama = document.getElementById('pegawai-form-nama').value.trim();
    const profesi = document.getElementById('pegawai-form-profesi').value.trim();
    const nip = document.getElementById('pegawai-form-nip').value.trim();
    const no_hp = document.getElementById('pegawai-form-nohp').value.trim();

    if (!nama || !profesi) {
        alert('Nama lengkap dan profesi wajib diisi!');
        return;
    }

    const endpoint = id ? '/api/pegawai/edit' : '/api/pegawai/add';
    const payload = id ? { id: parseInt(id, 10), nama, profesi, nip, no_hp } : { nama, profesi, nip, no_hp };

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.status === 'success') {
            resetPegawaiForm();
            await loadDashboardData();
            renderPegawaiTable();
        } else {
            alert(data.message || 'Gagal menyimpan pegawai');
        }
    } catch (err) {
        console.error("Save pegawai error:", err);
        alert("Terjadi kesalahan sistem saat menyimpan data pegawai.");
    }
}

function promptDeletePegawai(id) {
    const span = document.getElementById(`pegawai-action-${id}`);
    if (!span) return;
    span.innerHTML = `
        <span class="text-rose-400 text-[10px] font-bold mr-1">Yakin?</span>
        <button type="button" onclick="executeDeletePegawai(${id})" class="px-2.5 py-1 bg-rose-700 hover:bg-rose-600 text-white rounded-lg text-[10px] font-bold border border-rose-500 transition cursor-pointer">
            Ya, Hapus
        </button>
        <button type="button" onclick="renderPegawaiTable()" class="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-[10px] font-bold border border-slate-600 transition cursor-pointer">
            Batal
        </button>
    `;
}

async function executeDeletePegawai(id) {
    try {
        const res = await fetch('/api/pegawai/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id })
        });

        const data = await res.json();
        if (data.status === 'success') {
            await loadDashboardData();
            renderPegawaiTable();
        } else {
            alert(data.message || 'Gagal menghapus pegawai');
            renderPegawaiTable();
        }
    } catch (err) {
        console.error("Delete pegawai error:", err);
        renderPegawaiTable();
    }
}

async function submitImportExcel() {
    const fileInput = document.getElementById('excel-file-input');
    const chkReset = document.getElementById('chk-reset-jadwal');
    const btnSubmit = document.getElementById('btn-submit-import');
    const statusMsg = document.getElementById('import-status-msg');

    if (!fileInput || !fileInput.files.length) {
        alert('Silakan pilih file Excel (.xlsx) terlebih dahulu!');
        return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('reset_jadwal', chkReset ? chkReset.checked : true);

    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Mengimpor Data Real...`;
    }

    try {
        const res = await fetch('/api/import/excel', {
            method: 'POST',
            body: formData
        });

        const data = await res.json();
        if (data.status === 'success') {
            if (statusMsg) {
                statusMsg.className = 'text-xs p-2.5 rounded-lg bg-teal-950 text-teal-200 border border-teal-800 block';
                statusMsg.innerText = data.message;
            }
            alert(data.message);
            closePegawaiModal();
            loadDashboardData();
        } else {
            if (statusMsg) {
                statusMsg.className = 'text-xs p-2.5 rounded-lg bg-rose-950 text-rose-200 border border-rose-800 block';
                statusMsg.innerText = data.message || 'Gagal mengimpor data';
            }
            alert(data.message || 'Gagal mengimpor file Excel');
        }
    } catch (err) {
        console.error("Import error:", err);
        alert("Terjadi kesalahan saat mengunggah file.");
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<i data-lucide="upload" class="w-4 h-4"></i> Upload & Impor Data Real`;
            if (window.lucide) lucide.createIcons();
        }
    }
}

// Global window function bindings
window.openPegawaiModal = openPegawaiModal;
window.closePegawaiModal = closePegawaiModal;
window.openImportModal = openImportModal;
window.closeImportModal = closeImportModal;
window.switchPegawaiTab = switchPegawaiTab;
window.resetPegawaiForm = resetPegawaiForm;
window.editPegawaiForm = editPegawaiForm;
window.renderPegawaiTable = renderPegawaiTable;
window.filterPegawaiTable = filterPegawaiTable;
window.savePegawai = savePegawai;
window.promptDeletePegawai = promptDeletePegawai;
window.executeDeletePegawai = executeDeletePegawai;
window.submitImportExcel = submitImportExcel;
