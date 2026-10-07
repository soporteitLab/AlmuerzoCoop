// Cooperativa de Río Tercero — Control de Almuerzo Call Center (Vanilla JS)
const SUPERVISOR_PASSWORD = 'Masmejor390$';

const INITIAL_OPERATORS = [
  { id: 'op-1', name: 'Camila', lastName: 'Varela', legajo: 'OP-301', status: 'ALMUERZO', lunchStartTime: Date.now() - 34 * 60 * 1000, avatarColor: 'from-blue-600 to-indigo-700' },
  { id: 'op-2', name: 'Tomás', lastName: 'Benítez', legajo: 'OP-304', status: 'ALMUERZO', lunchStartTime: Date.now() - 14 * 60 * 1000, avatarColor: 'from-amber-600 to-orange-700' },
  { id: 'op-3', name: 'Agustina', lastName: 'Carrizo', legajo: 'OP-308', status: 'DISPONIBLE', lunchStartTime: null, avatarColor: 'from-emerald-600 to-teal-700' },
  { id: 'op-4', name: 'Lucas', lastName: 'Maldonado', legajo: 'OP-312', status: 'DISPONIBLE', lunchStartTime: null, avatarColor: 'from-cyan-600 to-blue-700' },
  { id: 'op-5', name: 'Micaela', lastName: 'Gómez', legajo: 'OP-315', status: 'DISPONIBLE', lunchStartTime: null, avatarColor: 'from-purple-600 to-pink-700' },
  { id: 'op-6', name: 'Federico', lastName: 'Ponce', legajo: 'OP-319', status: 'DISPONIBLE', lunchStartTime: null, avatarColor: 'from-indigo-600 to-blue-800' },
  { id: 'op-7', name: 'Julieta', lastName: 'Romero', legajo: 'OP-322', status: 'ALMUERZO', lunchStartTime: Date.now() - 8 * 60 * 1000, avatarColor: 'from-rose-600 to-red-700' },
  { id: 'op-8', name: 'Nicolás', lastName: 'Peralta', legajo: 'OP-325', status: 'DISPONIBLE', lunchStartTime: null, avatarColor: 'from-slate-700 to-slate-900' },
];

const INITIAL_RECORDS = [
  { id: 'rec-1', operatorId: 'op-4', operatorName: 'Lucas Maldonado', legajo: 'OP-312', startTime: Date.now() - 110 * 60 * 1000, endTime: Date.now() - 82 * 60 * 1000, durationMinutes: 28, wasExceeded: false },
  { id: 'rec-2', operatorId: 'op-3', operatorName: 'Agustina Carrizo', legajo: 'OP-308', startTime: Date.now() - 150 * 60 * 1000, endTime: Date.now() - 118 * 60 * 1000, durationMinutes: 32, wasExceeded: true },
];

let operators = JSON.parse(localStorage.getItem('crt_callcenter_operators')) || INITIAL_OPERATORS;
let records = JSON.parse(localStorage.getItem('crt_callcenter_records')) || INITIAL_RECORDS;
let config = JSON.parse(localStorage.getItem('crt_callcenter_config')) || { maxSimultaneousBreaks: 3, maxLunchMinutes: 30, soundEnabled: true };
let isSupervisorAuth = sessionStorage.getItem('crt_supervisor_auth') === 'true';
let currentRole = isSupervisorAuth ? 'supervisor' : 'operador';
let currentStatusFilter = 'TODOS';
let currentSearchQuery = '';
let operatorPendingDelete = null;

const saveOperators = () => localStorage.setItem('crt_callcenter_operators', JSON.stringify(operators));
const saveRecords = () => localStorage.setItem('crt_callcenter_records', JSON.stringify(records));
const saveConfig = () => localStorage.setItem('crt_callcenter_config', JSON.stringify(config));

const getElapsedTime = (startTimeMs) => {
  const elapsed = Math.max(0, Date.now() - startTimeMs);
  const totalSec = Math.floor(elapsed / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return { minutes: mins, seconds: secs, display: `${mins}:${secs < 10 ? '0' : ''}${secs}` };
};

const updateDashboard = () => {
  const total = operators.length;
  const inLunch = operators.filter(o => o.status === 'ALMUERZO');
  const inLunchCount = inLunch.length;
  const availableCount = total - inLunchCount;
  const exceededCount = inLunch.filter(o => o.lunchStartTime && Math.floor((Date.now() - o.lunchStartTime) / 60000) > config.maxLunchMinutes).length;
  const isCapacityReached = inLunchCount >= config.maxSimultaneousBreaks;

  document.getElementById('kpi-total').textContent = total;
  document.getElementById('kpi-available').textContent = availableCount;
  document.getElementById('kpi-lunch').textContent = inLunchCount;
  document.getElementById('kpi-lunch-limit').innerHTML = `Máximo: <strong>${config.maxSimultaneousBreaks}</strong>`;
  document.getElementById('kpi-exceeded').textContent = exceededCount;

  const banner = document.getElementById('capacity-alert-banner');
  if (isCapacityReached) {
    banner.classList.remove('hidden');
    banner.classList.add('flex');
  } else {
    banner.classList.add('hidden');
    banner.classList.remove('flex');
  }

  document.getElementById('count-filter-all').textContent = total;
  document.getElementById('count-filter-available').textContent = availableCount;
  document.getElementById('count-filter-lunch').textContent = inLunchCount;
  document.getElementById('operators-count').textContent = total;
  document.getElementById('records-count').textContent = `${records.length} turnos`;
};

const renderOperators = () => {
  const container = document.getElementById('operators-grid');
  if (!container) return;

  const filtered = operators.filter(op => {
    const fullText = `${op.name} ${op.lastName} ${op.legajo}`.toLowerCase();
    const matchesSearch = fullText.includes(currentSearchQuery.toLowerCase().trim());
    const matchesStatus = currentStatusFilter === 'TODOS' ? true : op.status === currentStatusFilter;
    return matchesSearch && matchesStatus;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="col-span-full p-8 text-center text-slate-400 bg-white rounded-2xl border">No se encontraron operadores coincidentes.</div>`;
    return;
  }

  container.innerHTML = filtered.map(op => {
    const isLunch = op.status === 'ALMUERZO';
    const timeData = isLunch && op.lunchStartTime ? getElapsedTime(op.lunchStartTime) : null;
    const isExceeded = timeData ? timeData.minutes >= config.maxLunchMinutes : false;

    return `
      <div class="rounded-2xl p-4 flex flex-col justify-between border shadow-xs ${
        isExceeded ? 'bg-red-50 border-red-400 ring-2 ring-red-400 animate-urgent-pulse' : isLunch ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200'
      }">
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <span class="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">${op.legajo}</span>
            ${currentRole === 'supervisor' ? `<button onclick="deleteOp('${op.id}')" class="text-slate-400 hover:text-red-600 text-xs font-bold cursor-pointer">✕ Eliminar</button>` : ''}
          </div>
          <div>
            <h3 class="font-bold text-slate-900">${op.name} ${op.lastName}</h3>
            <span class="inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full ${isLunch ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">
              ${isLunch ? 'En Almuerzo' : 'Disponible'}
            </span>
          </div>
          ${isLunch && timeData ? `
            <div class="p-2.5 rounded-xl border text-xs font-mono ${isExceeded ? 'bg-red-100 border-red-300 text-red-900' : 'bg-amber-100 border-amber-200 text-amber-900'}">
              <div>Tiempo: <strong>${timeData.display} min</strong></div>
              ${isExceeded ? '<div class="text-[11px] font-bold text-red-700">¡Tiempo excedido!</div>' : ''}
            </div>` : ''}
        </div>
        <div class="mt-4">
          <button onclick="toggleLunch('${op.id}')" class="w-full py-2 px-3 rounded-xl font-bold text-xs text-white cursor-pointer ${
            isLunch ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
          }">
            ${isLunch ? 'Volver del Almuerzo' : 'Salir a Almorzar'}
          </button>
        </div>
      </div>
    `;
  }).join('');
};

const renderRecords = () => {
  const tbody = document.getElementById('records-tbody');
  const empty = document.getElementById('records-empty');
  if (!tbody || !empty) return;

  if (records.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  tbody.innerHTML = records.map(rec => `
    <tr class="hover:bg-slate-50">
      <td class="px-4 py-3 font-mono font-bold text-xs text-blue-700">${rec.legajo}</td>
      <td class="px-4 py-3 font-bold text-slate-800">${rec.operatorName}</td>
      <td class="px-3 py-3 text-center font-mono text-slate-600">${new Date(rec.startTime).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</td>
      <td class="px-3 py-3 text-center font-mono text-slate-600">${new Date(rec.endTime).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</td>
      <td class="px-3 py-3 text-center font-mono font-bold">${rec.durationMinutes} min</td>
      <td class="px-4 py-3 text-right">
        <span class="text-xs font-bold px-2 py-0.5 rounded-full ${rec.wasExceeded ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}">
          ${rec.wasExceeded ? 'Excedido' : 'A tiempo'}
        </span>
      </td>
    </tr>
  `).join('');
};

window.toggleLunch = (id) => {
  const op = operators.find(o => o.id === id);
  if (!op) return;

  if (op.status === 'DISPONIBLE') {
    const inLunchCount = operators.filter(o => o.status === 'ALMUERZO').length;
    if (inLunchCount >= config.maxSimultaneousBreaks) {
      if (!confirm(`¡Capacidad alcanzada! Hay ${inLunchCount} en receso. ¿Continuar?`)) return;
    }
    op.status = 'ALMUERZO';
    op.lunchStartTime = Date.now();
  } else {
    const startTime = op.lunchStartTime || Date.now();
    const durationMinutes = Math.max(1, Math.round((Date.now() - startTime) / 60000));
    const wasExceeded = durationMinutes > config.maxLunchMinutes;

    records.unshift({
      id: `rec-${Date.now()}`,
      operatorId: op.id,
      operatorName: `${op.name} ${op.lastName}`,
      legajo: op.legajo,
      startTime,
      endTime: Date.now(),
      durationMinutes,
      wasExceeded,
    });
    saveRecords();
    op.status = 'DISPONIBLE';
    op.lunchStartTime = null;
  }

  saveOperators();
  updateDashboard();
  renderOperators();
  renderRecords();
};

window.deleteOp = (id) => {
  const op = operators.find(o => o.id === id);
  if (!op) return;
  operatorPendingDelete = op;
  document.getElementById('delete-op-desc').innerHTML = `Se removerá a <strong>${op.name} ${op.lastName}</strong> (${op.legajo}).`;
  document.getElementById('modal-delete').classList.remove('hidden');
  document.getElementById('modal-delete').classList.add('flex');
};

document.addEventListener('DOMContentLoaded', () => {
  setInterval(() => {
    document.getElementById('clock-display').textContent = new Date().toLocaleTimeString('es-AR');
    if (operators.some(o => o.status === 'ALMUERZO')) {
      renderOperators();
      updateDashboard();
    }
  }, 1000);

  updateDashboard();
  renderOperators();
  renderRecords();

  document.getElementById('btn-role-operador').addEventListener('click', () => {
    currentRole = 'operador';
    document.getElementById('btn-add-op-header').classList.add('hidden');
    document.getElementById('btn-clear-records').classList.add('hidden');
    document.getElementById('btn-lock-supervisor').classList.add('hidden');
    document.getElementById('supervisor-actions').classList.add('hidden');
    renderOperators();
  });

  document.getElementById('btn-role-supervisor').addEventListener('click', () => {
    if (isSupervisorAuth) {
      currentRole = 'supervisor';
      document.getElementById('btn-add-op-header').classList.remove('hidden');
      document.getElementById('btn-clear-records').classList.remove('hidden');
      document.getElementById('btn-lock-supervisor').classList.remove('hidden');
      document.getElementById('supervisor-actions').classList.remove('hidden');
      renderOperators();
    } else {
      document.getElementById('modal-password').classList.remove('hidden');
      document.getElementById('modal-password').classList.add('flex');
    }
  });

  document.getElementById('form-password').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = document.getElementById('input-password').value;
    if (val === SUPERVISOR_PASSWORD) {
      isSupervisorAuth = true;
      sessionStorage.setItem('crt_supervisor_auth', 'true');
      currentRole = 'supervisor';
      document.getElementById('modal-password').classList.add('hidden');
      document.getElementById('modal-password').classList.remove('flex');
      document.getElementById('btn-add-op-header').classList.remove('hidden');
      document.getElementById('btn-clear-records').classList.remove('hidden');
      document.getElementById('btn-lock-supervisor').classList.remove('hidden');
      document.getElementById('supervisor-actions').classList.remove('hidden');
      renderOperators();
    } else {
      document.getElementById('password-error-msg').classList.remove('hidden');
    }
  });

  document.getElementById('btn-cancel-password').addEventListener('click', () => {
    document.getElementById('modal-password').classList.add('hidden');
    document.getElementById('modal-password').classList.remove('flex');
  });

  document.getElementById('btn-lock-supervisor').addEventListener('click', () => {
    isSupervisorAuth = false;
    sessionStorage.removeItem('crt_supervisor_auth');
    currentRole = 'operador';
    document.getElementById('btn-add-op-header').classList.add('hidden');
    document.getElementById('btn-clear-records').classList.add('hidden');
    document.getElementById('btn-lock-supervisor').classList.add('hidden');
    document.getElementById('supervisor-actions').classList.add('hidden');
    renderOperators();
  });

  document.getElementById('search-input').addEventListener('input', (e) => {
    currentSearchQuery = e.target.value;
    renderOperators();
  });

  document.querySelectorAll('[data-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentStatusFilter = btn.getAttribute('data-status');
      renderOperators();
    });
  });

  // Modal Nuevo Operador (Sólo Nombre y Apellido)
  const openAdd = () => {
    document.getElementById('input-add-name').value = '';
    document.getElementById('input-add-lastname').value = '';
    document.getElementById('modal-add-operator').classList.remove('hidden');
    document.getElementById('modal-add-operator').classList.add('flex');
  };
  document.getElementById('btn-open-add').addEventListener('click', openAdd);
  document.getElementById('btn-add-op-header').addEventListener('click', openAdd);

  document.getElementById('btn-cancel-add').addEventListener('click', () => {
    document.getElementById('modal-add-operator').classList.add('hidden');
    document.getElementById('modal-add-operator').classList.remove('flex');
  });

  document.getElementById('form-add-operator').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('input-add-name').value.trim();
    const lastName = document.getElementById('input-add-lastname').value.trim();
    if (!name || !lastName) return;

    const existingNums = operators.map(o => parseInt(o.legajo.replace(/\D/g, ''), 10)).filter(n => !isNaN(n));
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 330;

    operators.unshift({
      id: `op-${Date.now()}`,
      name,
      lastName,
      legajo: `OP-${nextNum}`,
      status: 'DISPONIBLE',
      lunchStartTime: null,
      avatarColor: 'from-blue-600 to-indigo-700',
    });

    saveOperators();
    document.getElementById('modal-add-operator').classList.add('hidden');
    document.getElementById('modal-add-operator').classList.remove('flex');
    updateDashboard();
    renderOperators();
  });

  // Confirmar eliminación
  document.getElementById('btn-confirm-delete').addEventListener('click', () => {
    if (operatorPendingDelete) {
      operators = operators.filter(o => o.id !== operatorPendingDelete.id);
      saveOperators();
      operatorPendingDelete = null;
      document.getElementById('modal-delete').classList.add('hidden');
      document.getElementById('modal-delete').classList.remove('flex');
      updateDashboard();
      renderOperators();
    }
  });

  document.getElementById('btn-cancel-delete').addEventListener('click', () => {
    operatorPendingDelete = null;
    document.getElementById('modal-delete').classList.add('hidden');
    document.getElementById('modal-delete').classList.remove('flex');
  });

  // Modal Parámetros
  document.getElementById('btn-open-config').addEventListener('click', () => {
    document.getElementById('slider-capacity').value = config.maxSimultaneousBreaks;
    document.getElementById('slider-capacity-val').textContent = config.maxSimultaneousBreaks;
    document.getElementById('modal-config').classList.remove('hidden');
    document.getElementById('modal-config').classList.add('flex');
  });

  document.getElementById('slider-capacity').addEventListener('input', (e) => {
    document.getElementById('slider-capacity-val').textContent = e.target.value;
  });

  document.getElementById('btn-save-config').addEventListener('click', () => {
    config.maxSimultaneousBreaks = parseInt(document.getElementById('slider-capacity').value, 10) || 3;
    saveConfig();
    document.getElementById('modal-config').classList.add('hidden');
    document.getElementById('modal-config').classList.remove('flex');
    updateDashboard();
  });

  // Exportar CSV
  document.getElementById('btn-export-csv').addEventListener('click', () => {
    if (records.length === 0) return alert('No hay registros hoy.');
    const headers = ['Legajo', 'Operador', 'Hora Salida', 'Hora Regreso', 'Duración Total (min)', 'Estado'];
    const rows = records.map(r => [
      `"${r.legajo}"`, `"${r.operatorName}"`,
      `"${new Date(r.startTime).toLocaleTimeString('es-AR')}"`,
      `"${new Date(r.endTime).toLocaleTimeString('es-AR')}"`,
      r.durationMinutes, r.wasExceeded ? 'EXCEDIDO' : 'A TIEMPO'
    ]);
    const csv = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `call_center_almuerzos_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  });

  // Reiniciar
  document.getElementById('btn-clear-records').addEventListener('click', () => {
    document.getElementById('modal-clear-records').classList.remove('hidden');
    document.getElementById('modal-clear-records').classList.add('flex');
  });

  document.getElementById('btn-confirm-clear').addEventListener('click', () => {
    records = [];
    saveRecords();
    document.getElementById('modal-clear-records').classList.add('hidden');
    document.getElementById('modal-clear-records').classList.remove('flex');
    renderRecords();
    updateDashboard();
  });

  document.getElementById('btn-cancel-clear').addEventListener('click', () => {
    document.getElementById('modal-clear-records').classList.add('hidden');
    document.getElementById('modal-clear-records').classList.remove('flex');
  });
});
