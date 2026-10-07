import './index.css';

// --- CONFIGURACIÓN Y CONSTANTES ---
const SUPERVISOR_PASSWORD = 'Masmejor390$';

export interface Operator {
  id: string;
  name: string;
  lastName: string;
  legajo: string;
  area?: string;
  status: 'DISPONIBLE' | 'ALMUERZO';
  lunchStartTime: number | null; // Timestamp ms
  avatarColor: string;
}

export interface LunchRecord {
  id: string;
  operatorId: string;
  operatorName: string;
  legajo: string;
  startTime: number;
  endTime: number;
  durationMinutes: number;
  wasExceeded: boolean;
}

export interface AppConfig {
  maxSimultaneousBreaks: number;
  maxLunchMinutes: number;
  soundEnabled: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  maxSimultaneousBreaks: 3,
  maxLunchMinutes: 30,
  soundEnabled: true,
};

// Datos iniciales de Operadores de la Cooperativa de Río Tercero
const INITIAL_OPERATORS: Operator[] = [
  {
    id: 'op-1',
    name: 'Camila',
    lastName: 'Varela',
    legajo: 'OP-301',
    status: 'ALMUERZO',
    lunchStartTime: Date.now() - 34 * 60 * 1000, // Hace 34 min (>30 min: muestra alerta)
    avatarColor: 'from-blue-600 to-indigo-700',
  },
  {
    id: 'op-2',
    name: 'Tomás',
    lastName: 'Benítez',
    legajo: 'OP-304',
    status: 'ALMUERZO',
    lunchStartTime: Date.now() - 14 * 60 * 1000,
    avatarColor: 'from-amber-600 to-orange-700',
  },
  {
    id: 'op-3',
    name: 'Agustina',
    lastName: 'Carrizo',
    legajo: 'OP-308',
    status: 'DISPONIBLE',
    lunchStartTime: null,
    avatarColor: 'from-emerald-600 to-teal-700',
  },
  {
    id: 'op-4',
    name: 'Lucas',
    lastName: 'Maldonado',
    legajo: 'OP-312',
    status: 'DISPONIBLE',
    lunchStartTime: null,
    avatarColor: 'from-cyan-600 to-blue-700',
  },
  {
    id: 'op-5',
    name: 'Micaela',
    lastName: 'Gómez',
    legajo: 'OP-315',
    status: 'DISPONIBLE',
    lunchStartTime: null,
    avatarColor: 'from-purple-600 to-pink-700',
  },
  {
    id: 'op-6',
    name: 'Federico',
    lastName: 'Ponce',
    legajo: 'OP-319',
    status: 'DISPONIBLE',
    lunchStartTime: null,
    avatarColor: 'from-indigo-600 to-blue-800',
  },
  {
    id: 'op-7',
    name: 'Julieta',
    lastName: 'Romero',
    legajo: 'OP-322',
    status: 'ALMUERZO',
    lunchStartTime: Date.now() - 8 * 60 * 1000,
    avatarColor: 'from-rose-600 to-red-700',
  },
  {
    id: 'op-8',
    name: 'Nicolás',
    lastName: 'Peralta',
    legajo: 'OP-325',
    status: 'DISPONIBLE',
    lunchStartTime: null,
    avatarColor: 'from-slate-700 to-slate-900',
  },
];

const INITIAL_RECORDS: LunchRecord[] = [
  {
    id: 'rec-1',
    operatorId: 'op-4',
    operatorName: 'Lucas Maldonado',
    legajo: 'OP-312',
    startTime: Date.now() - 110 * 60 * 1000,
    endTime: Date.now() - 82 * 60 * 1000,
    durationMinutes: 28,
    wasExceeded: false,
  },
  {
    id: 'rec-2',
    operatorId: 'op-3',
    operatorName: 'Agustina Carrizo',
    legajo: 'OP-308',
    startTime: Date.now() - 150 * 60 * 1000,
    endTime: Date.now() - 118 * 60 * 1000,
    durationMinutes: 32,
    wasExceeded: true,
  },
];

// --- ESTADO GLOBAL EN MEMORIA Y PERSISTENCIA ---
let operators: Operator[] = (() => {
  const saved = localStorage.getItem('crt_callcenter_operators');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return INITIAL_OPERATORS;
    }
  }
  return INITIAL_OPERATORS;
})();

let records: LunchRecord[] = (() => {
  const saved = localStorage.getItem('crt_callcenter_records');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return INITIAL_RECORDS;
    }
  }
  return INITIAL_RECORDS;
})();

let config: AppConfig = (() => {
  const saved = localStorage.getItem('crt_callcenter_config');
  if (saved) {
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    } catch {
      return DEFAULT_CONFIG;
    }
  }
  return DEFAULT_CONFIG;
})();

let isSupervisorAuth: boolean = sessionStorage.getItem('crt_supervisor_auth') === 'true';
let currentRole: 'operador' | 'supervisor' = isSupervisorAuth ? 'supervisor' : 'operador';
let currentStatusFilter: 'TODOS' | 'DISPONIBLE' | 'ALMUERZO' = 'TODOS';
let currentSearchQuery: string = '';
let operatorPendingDelete: Operator | null = null;
let toastTimeout: NodeJS.Timeout | null = null;

// Funciones de persistencia
const saveOperators = () => localStorage.setItem('crt_callcenter_operators', JSON.stringify(operators));
const saveRecords = () => localStorage.setItem('crt_callcenter_records', JSON.stringify(records));
const saveConfig = () => localStorage.setItem('crt_callcenter_config', JSON.stringify(config));

// --- GENERADOR DE TONOS WEB AUDIO API ---
const playBeep = (type: 'start' | 'return' | 'alert' | 'denied') => {
  if (!config.soundEnabled) return;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'start') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(587.33, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'return') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.setValueAtTime(180, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.16, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.38);
    }
  } catch {
    // Continuar si navegador bloquea audio
  }
};

// --- NOTIFICACIÓN TOAST FLOTANTE ---
const showToast = (text: string, type: 'success' | 'warning' | 'info' = 'success') => {
  const container = document.getElementById('toast-container');
  if (!container) return;

  if (toastTimeout) clearTimeout(toastTimeout);
  container.innerHTML = '';

  const toastEl = document.createElement('div');
  toastEl.className = 'flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border text-sm font-medium animate-bounce backdrop-blur-md bg-white/95 border-slate-200 pointer-events-auto';

  let iconSvg = '';
  if (type === 'success') {
    iconSvg = '<svg class="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
  } else if (type === 'warning') {
    iconSvg = '<svg class="w-5 h-5 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>';
  } else {
    iconSvg = '<svg class="w-5 h-5 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
  }

  toastEl.innerHTML = `${iconSvg}<span class="text-slate-800">${text}</span>`;
  container.appendChild(toastEl);

  toastTimeout = setTimeout(() => {
    container.innerHTML = '';
  }, 3800);
};

// --- CÁLCULO DE TIEMPO TRANSCURRIDO ---
const getElapsedTime = (startTimeMs: number) => {
  const elapsed = Math.max(0, Date.now() - startTimeMs);
  const totalSec = Math.floor(elapsed / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return {
    minutes: mins,
    seconds: secs,
    display: `${mins}:${secs < 10 ? '0' : ''}${secs}`,
  };
};

// --- RENDERIZADO DEL DASHBOARD Y KPI ---
const updateDashboard = () => {
  const total = operators.length;
  const inLunch = operators.filter((o) => o.status === 'ALMUERZO');
  const inLunchCount = inLunch.length;
  const availableCount = total - inLunchCount;

  // Conteo de excedidos
  const exceededCount = inLunch.filter((o) => {
    if (!o.lunchStartTime) return false;
    const elapsedMinutes = Math.floor((Date.now() - o.lunchStartTime) / 60000);
    return elapsedMinutes > config.maxLunchMinutes;
  }).length;

  const isCapacityReached = inLunchCount >= config.maxSimultaneousBreaks;

  // Actualizar textos en el DOM
  document.getElementById('kpi-total')!.textContent = total.toString();
  document.getElementById('kpi-available')!.textContent = availableCount.toString();
  document.getElementById('kpi-lunch')!.textContent = inLunchCount.toString();
  document.getElementById('kpi-lunch-limit')!.innerHTML = `Máximo permitido: <strong>${config.maxSimultaneousBreaks}</strong> a la vez`;
  document.getElementById('kpi-exceeded')!.textContent = exceededCount.toString();
  document.getElementById('kpi-exceeded-sub')!.textContent = `(>${config.maxLunchMinutes} min)`;

  // Estilo tarjeta excedidos
  const kpiExceededCard = document.getElementById('kpi-exceeded-card');
  const kpiExceededStatus = document.getElementById('kpi-exceeded-status');
  if (exceededCount > 0) {
    kpiExceededCard?.classList.add('bg-red-50/80', 'border-red-300');
    kpiExceededCard?.classList.remove('bg-white', 'border-slate-200/90');
    if (kpiExceededStatus) kpiExceededStatus.innerHTML = '<span class="text-red-600 font-bold">¡Demora en retomar guardia!</span>';
  } else {
    kpiExceededCard?.classList.remove('bg-red-50/80', 'border-red-300');
    kpiExceededCard?.classList.add('bg-white', 'border-slate-200/90');
    if (kpiExceededStatus) kpiExceededStatus.textContent = 'Tiempos en norma operativa';
  }

  // Banner de alerta de capacidad
  const banner = document.getElementById('capacity-alert-banner');
  const bannerTitle = document.getElementById('capacity-alert-title');
  if (isCapacityReached) {
    banner?.classList.remove('hidden');
    banner?.classList.add('flex');
    if (bannerTitle) bannerTitle.textContent = `¡Atención! Cupo Máximo Simultáneo Alcanzado (${inLunchCount}/${config.maxSimultaneousBreaks})`;
  } else {
    banner?.classList.add('hidden');
    banner?.classList.remove('flex');
  }

  // Filtros contadores
  document.getElementById('count-filter-all')!.textContent = total.toString();
  document.getElementById('count-filter-available')!.textContent = availableCount.toString();
  document.getElementById('count-filter-lunch')!.textContent = inLunchCount.toString();
  document.getElementById('operators-count')!.textContent = total.toString();
  document.getElementById('records-count')!.textContent = `${records.length} turnos`;
};

// --- RENDERIZADO DE TARJETAS DE OPERADORES ---
const renderOperators = () => {
  const container = document.getElementById('operators-grid');
  if (!container) return;

  const filtered = operators.filter((op) => {
    const fullText = `${op.name} ${op.lastName} ${op.legajo}`.toLowerCase();
    const matchesSearch = fullText.includes(currentSearchQuery.toLowerCase().trim());
    const matchesStatus = currentStatusFilter === 'TODOS' ? true : op.status === currentStatusFilter;
    return matchesSearch && matchesStatus;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full bg-white rounded-2xl p-10 text-center border border-slate-200 text-slate-500 space-y-2">
        <svg class="w-8 h-8 mx-auto text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <p class="text-sm font-bold text-slate-700">No se encontraron operadores coincidentes.</p>
        <p class="text-xs text-slate-400">Verifica la búsqueda de texto o el filtro de estado.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map((op) => {
      const isLunch = op.status === 'ALMUERZO';
      const timeData = isLunch && op.lunchStartTime ? getElapsedTime(op.lunchStartTime) : null;
      const isExceeded = timeData ? timeData.minutes >= config.maxLunchMinutes : false;
      const progressPercent = timeData ? Math.min(100, (timeData.minutes / config.maxLunchMinutes) * 100) : 0;

      return `
        <div class="rounded-2xl transition-all duration-300 relative flex flex-col justify-between overflow-hidden border shadow-xs hover:shadow-md ${
          isExceeded
            ? 'bg-red-50/80 border-red-400 animate-urgent-pulse ring-2 ring-red-400/30'
            : isLunch
            ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-200'
            : 'bg-white border-slate-200 hover:border-blue-300'
        }">
          ${
            isExceeded && timeData
              ? `
            <div class="bg-red-600 text-white text-[11px] font-extrabold uppercase px-3 py-1 flex items-center justify-between tracking-wide shadow-xs">
              <span class="flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                Tiempo Excedido
              </span>
              <span>+${timeData.minutes - config.maxLunchMinutes} min</span>
            </div>`
              : ''
          }

          <div class="p-4 sm:p-5 flex-1 space-y-3.5">
            <!-- Cabecera de Tarjeta: Legajo y Botón Eliminar si Supervisor -->
            <div class="flex items-center justify-between gap-2">
              <span class="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                ${op.legajo}
              </span>
              ${
                currentRole === 'supervisor'
                  ? `
                <button
                  type="button"
                  data-action="delete-op"
                  data-id="${op.id}"
                  class="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer"
                  title="Eliminar operador del sistema"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>`
                  : ''
              }
            </div>

            <!-- Datos del Operador -->
            <div class="flex items-start gap-3">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-tr ${op.avatarColor} text-white font-bold text-lg flex items-center justify-center shrink-0 shadow-md">
                ${op.name[0]}${op.lastName[0]}
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="font-bold text-slate-900 text-base leading-tight truncate">
                  ${op.name} ${op.lastName}
                </h3>
                <p class="text-xs text-slate-500">Operador Call Center</p>

                <!-- Badge de Estado -->
                <div class="mt-2 flex items-center gap-2">
                  ${
                    isLunch
                      ? `
                    <span class="inline-flex items-center gap-1.5 text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                      isExceeded ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }">
                      <span class="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                      En Almuerzo
                    </span>`
                      : `
                    <span class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Disponible
                    </span>`
                  }
                </div>
              </div>
            </div>

            <!-- Panel de Cronómetro en Vivo (Si está en Almuerzo) -->
            ${
              isLunch && op.lunchStartTime && timeData
                ? `
              <div class="rounded-xl p-3 border transition-colors ${
                isExceeded ? 'bg-red-100/70 border-red-300 text-red-900' : 'bg-amber-100/60 border-amber-200 text-amber-950'
              }">
                <div class="flex items-center justify-between text-xs mb-1">
                  <span class="text-slate-600 font-medium">Salida:</span>
                  <span class="font-bold font-mono text-slate-800">
                    ${new Date(op.lunchStartTime).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                  </span>
                </div>
                <div class="flex items-baseline justify-between mt-1">
                  <span class="text-xs font-semibold text-slate-600">Cronómetro en vivo:</span>
                  <div class="font-mono text-lg font-black tracking-tight">
                    ${timeData.display}<span class="text-[11px] font-normal text-slate-500 ml-1">min</span>
                  </div>
                </div>
                <div class="w-full bg-white/80 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-200/50">
                  <div class="h-full transition-all duration-300 ${isExceeded ? 'bg-red-600' : 'bg-amber-500'}" style="width: ${progressPercent}%;"></div>
                </div>
              </div>`
                : ''
            }
          </div>

          <!-- Botón de Acción Principal -->
          <div class="p-4 pt-0">
            ${
              isLunch
                ? `
              <button
                type="button"
                data-action="toggle-lunch"
                data-id="${op.id}"
                class="w-full py-2.5 px-4 rounded-xl font-bold text-sm text-white shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 focus:ring-4 focus:ring-amber-200"
              >
                <svg class="w-4 h-4 text-amber-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                Volver del Almuerzo
              </button>`
                : `
              <button
                type="button"
                data-action="toggle-lunch"
                data-id="${op.id}"
                class="w-full py-2.5 px-4 rounded-xl font-bold text-sm text-white shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-200"
              >
                <svg class="w-4 h-4 text-cyan-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                Salir a Almorzar
              </button>`
            }
          </div>
        </div>
      `;
    })
    .join('');
};

// --- RENDERIZADO DE BITÁCORA ---
const renderRecords = () => {
  const tbody = document.getElementById('records-tbody');
  const emptyMsg = document.getElementById('records-empty');
  if (!tbody || !emptyMsg) return;

  if (records.length === 0) {
    tbody.innerHTML = '';
    emptyMsg.classList.remove('hidden');
    return;
  }

  emptyMsg.classList.add('hidden');
  tbody.innerHTML = records
    .map(
      (rec) => `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="px-4 py-3.5 whitespace-nowrap font-mono font-bold text-xs text-blue-700">${rec.legajo}</td>
        <td class="px-4 py-3.5 whitespace-nowrap font-bold text-slate-800">${rec.operatorName}</td>
        <td class="px-3 py-3.5 whitespace-nowrap text-center font-mono text-slate-600 font-medium">
          ${new Date(rec.startTime).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
        </td>
        <td class="px-3 py-3.5 whitespace-nowrap text-center font-mono text-slate-600 font-medium">
          ${new Date(rec.endTime).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
        </td>
        <td class="px-3 py-3.5 whitespace-nowrap text-center">
          <span class="font-mono font-extrabold text-xs px-2 py-0.5 rounded ${
            rec.wasExceeded ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
          }">
            ${rec.durationMinutes} min
          </span>
        </td>
        <td class="px-4 py-3.5 whitespace-nowrap text-right">
          ${
            rec.wasExceeded
              ? `
            <span class="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2.5 py-1 rounded-full border border-red-200">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              Excedido (>${config.maxLunchMinutes}m)
            </span>`
              : `
            <span class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              A tiempo
            </span>`
          }
        </td>
      </tr>
    `
    )
    .join('');
};

// --- ACTUALIZAR VISTA SEGÚN EL ROL ACTIVO ---
const updateRoleView = () => {
  const btnOp = document.getElementById('btn-role-operador');
  const btnSup = document.getElementById('btn-role-supervisor');
  const lockBtn = document.getElementById('btn-lock-supervisor');
  const subBar = document.getElementById('sub-header-bar');
  const roleText = document.getElementById('role-info-text');
  const supActions = document.getElementById('supervisor-actions');
  const btnAddHeader = document.getElementById('btn-add-op-header');
  const btnClearRecords = document.getElementById('btn-clear-records');
  const badgeClave = document.getElementById('badge-clave');

  if (currentRole === 'supervisor' && isSupervisorAuth) {
    // Modo Supervisor
    btnSup?.classList.add('bg-amber-600', 'text-white', 'shadow-md');
    btnSup?.classList.remove('text-slate-400');
    btnOp?.classList.remove('bg-blue-600', 'text-white', 'shadow-md');
    btnOp?.classList.add('text-slate-400');

    lockBtn?.classList.remove('hidden');
    lockBtn?.classList.add('flex');
    badgeClave?.classList.add('hidden');

    subBar?.classList.remove('bg-blue-950/40', 'text-blue-200', 'border-blue-900/40');
    subBar?.classList.add('bg-amber-950/40', 'text-amber-300', 'border-amber-900/50');

    if (roleText) {
      roleText.innerHTML = `
        <svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
        <span>Perfil Activo: <strong>Supervisor (Autorizado)</strong> — Gestión de personal, límites de llamadas y bitácora.</span>
      `;
    }

    supActions?.classList.remove('hidden');
    supActions?.classList.add('flex');
    btnAddHeader?.classList.remove('hidden');
    btnAddHeader?.classList.add('flex');
    btnClearRecords?.classList.remove('hidden');
  } else {
    // Modo Operador
    btnOp?.classList.add('bg-blue-600', 'text-white', 'shadow-md');
    btnOp?.classList.remove('text-slate-400');
    btnSup?.classList.remove('bg-amber-600', 'text-white', 'shadow-md');
    btnSup?.classList.add('text-slate-400');

    lockBtn?.classList.add('hidden');
    lockBtn?.classList.remove('flex');
    badgeClave?.classList.remove('hidden');

    subBar?.classList.add('bg-blue-950/40', 'text-blue-200', 'border-blue-900/40');
    subBar?.classList.remove('bg-amber-950/40', 'text-amber-300', 'border-amber-900/50');

    if (roleText) {
      roleText.innerHTML = `
        <svg class="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
        <span>Perfil Activo: <strong>Operador</strong> — Localiza tu legajo para marcar tu salida o retorno de almuerzo.</span>
      `;
    }

    supActions?.classList.add('hidden');
    supActions?.classList.remove('flex');
    btnAddHeader?.classList.add('hidden');
    btnAddHeader?.classList.remove('flex');
    btnClearRecords?.classList.add('hidden');
  }

  renderOperators();
};

// --- GESTIÓN DE ACCIÓN DE ALMUERZO ---
const toggleLunch = (operatorId: string) => {
  const op = operators.find((o) => o.id === operatorId);
  if (!op) return;

  if (op.status === 'DISPONIBLE') {
    // Verificar cupo simultáneo
    const inLunchCount = operators.filter((o) => o.status === 'ALMUERZO').length;
    if (inLunchCount >= config.maxSimultaneousBreaks) {
      const proceed = window.confirm(
        `⚠️ ¡ALERTA DE COBERTURA DE LLAMADAS!\n\nActualmente hay ${inLunchCount} operadores en receso (límite máximo permitido: ${config.maxSimultaneousBreaks}).\n\nSi ${op.name} ${op.lastName} sale ahora, las líneas pueden quedar descubiertas. ¿Confirmar salida de todos modos?`
      );
      if (!proceed) return;
    }

    op.status = 'ALMUERZO';
    op.lunchStartTime = Date.now();
    saveOperators();
    playBeep('start');
    showToast(`${op.name} ${op.lastName} salió a receso/almuerzo`, 'info');
  } else {
    // Retorno
    const startTime = op.lunchStartTime || Date.now();
    const durationMinutes = Math.max(1, Math.round((Date.now() - startTime) / 60000));
    const wasExceeded = durationMinutes > config.maxLunchMinutes;

    const newRecord: LunchRecord = {
      id: `rec-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      operatorId: op.id,
      operatorName: `${op.name} ${op.lastName}`,
      legajo: op.legajo,
      startTime,
      endTime: Date.now(),
      durationMinutes,
      wasExceeded,
    };

    records.unshift(newRecord);
    saveRecords();

    op.status = 'DISPONIBLE';
    op.lunchStartTime = null;
    saveOperators();

    if (wasExceeded) {
      playBeep('alert');
      showToast(`${op.name} ${op.lastName} retornó tras ${durationMinutes} min (Tiempo excedido)`, 'warning');
    } else {
      playBeep('return');
      showToast(`${op.name} ${op.lastName} retomó atención en llamadas (${durationMinutes} min)`, 'success');
    }
  }

  updateDashboard();
  renderOperators();
  renderRecords();
};

// --- EVENTOS DEL DOM E INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
  // Reloj digital en tiempo real
  setInterval(() => {
    const clock = document.getElementById('clock-display');
    if (clock) {
      clock.textContent = new Date().toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    }
    // Actualizar cronómetros cada segundo si hay almorzando
    if (operators.some((o) => o.status === 'ALMUERZO')) {
      renderOperators();
      updateDashboard();
    }
  }, 1000);

  // Inicializar vistas
  updateRoleView();
  updateDashboard();
  renderRecords();

  // --- BOTONES DE CAMBIO DE ROL ---
  document.getElementById('btn-role-operador')?.addEventListener('click', () => {
    currentRole = 'operador';
    updateRoleView();
    showToast('Modo Operador activo', 'info');
  });

  document.getElementById('btn-role-supervisor')?.addEventListener('click', () => {
    if (isSupervisorAuth) {
      currentRole = 'supervisor';
      updateRoleView();
      showToast('Panel de Supervisor activo', 'success');
    } else {
      // Abrir modal de contraseña
      const modal = document.getElementById('modal-password');
      modal?.classList.remove('hidden');
      modal?.classList.add('flex');
      document.getElementById('password-error-msg')?.classList.add('hidden');
      (document.getElementById('input-password') as HTMLInputElement).value = '';
      (document.getElementById('input-password') as HTMLInputElement).focus();
    }
  });

  // Cerrar sesión / bloquear panel
  document.getElementById('btn-lock-supervisor')?.addEventListener('click', () => {
    isSupervisorAuth = false;
    sessionStorage.removeItem('crt_supervisor_auth');
    currentRole = 'operador';
    updateRoleView();
    showToast('Panel de supervisor bloqueado', 'info');
  });

  // --- VERIFICACIÓN DE CONTRASEÑA ---
  document.getElementById('form-password')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('input-password') as HTMLInputElement;
    const errorMsg = document.getElementById('password-error-msg');

    if (input.value === SUPERVISOR_PASSWORD) {
      isSupervisorAuth = true;
      sessionStorage.setItem('crt_supervisor_auth', 'true');
      currentRole = 'supervisor';
      document.getElementById('modal-password')?.classList.add('hidden');
      document.getElementById('modal-password')?.classList.remove('flex');
      updateRoleView();
      playBeep('return');
      showToast('Autenticación correcta. Bienvenido al Panel de Supervisor', 'success');
    } else {
      errorMsg?.classList.remove('hidden');
      errorMsg?.classList.add('flex');
      playBeep('denied');
    }
  });

  // Cerrar modal contraseña
  const closePasswordModal = () => {
    document.getElementById('modal-password')?.classList.add('hidden');
    document.getElementById('modal-password')?.classList.remove('flex');
  };
  document.getElementById('btn-close-password-modal')?.addEventListener('click', closePasswordModal);
  document.getElementById('btn-cancel-password')?.addEventListener('click', closePasswordModal);

  // Ver/ocultar contraseña
  document.getElementById('btn-toggle-password-view')?.addEventListener('click', () => {
    const input = document.getElementById('input-password') as HTMLInputElement;
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // --- BUSCADOR Y FILTROS ---
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  const btnClearSearch = document.getElementById('btn-clear-search');

  searchInput?.addEventListener('input', () => {
    currentSearchQuery = searchInput.value;
    if (currentSearchQuery) {
      btnClearSearch?.classList.remove('hidden');
    } else {
      btnClearSearch?.classList.add('hidden');
    }
    renderOperators();
  });

  btnClearSearch?.addEventListener('click', () => {
    searchInput.value = '';
    currentSearchQuery = '';
    btnClearSearch.classList.add('hidden');
    renderOperators();
  });

  // Filtros de Estado
  const statusButtons = [
    { id: 'filter-all', status: 'TODOS' },
    { id: 'filter-available', status: 'DISPONIBLE' },
    { id: 'filter-lunch', status: 'ALMUERZO' },
  ] as const;

  statusButtons.forEach(({ id, status }) => {
    document.getElementById(id)?.addEventListener('click', () => {
      currentStatusFilter = status;
      statusButtons.forEach((b) => {
        const el = document.getElementById(b.id);
        if (b.status === currentStatusFilter) {
          el?.classList.add('bg-slate-900', 'text-white', 'shadow-xs');
          el?.classList.remove('bg-slate-100', 'text-slate-600');
        } else {
          el?.classList.remove('bg-slate-900', 'text-white', 'shadow-xs');
          el?.classList.add('bg-slate-100', 'text-slate-600');
        }
      });
      renderOperators();
    });
  });

  // Delegación de eventos en las tarjetas de operadores (Salir/Volver & Eliminar)
  document.getElementById('operators-grid')?.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!target) return;

    const action = target.getAttribute('data-action');
    const id = target.getAttribute('data-id');
    if (!id) return;

    if (action === 'toggle-lunch') {
      toggleLunch(id);
    } else if (action === 'delete-op') {
      const op = operators.find((o) => o.id === id);
      if (!op) return;
      operatorPendingDelete = op;
      const desc = document.getElementById('delete-op-desc');
      if (desc) desc.innerHTML = `Se removerá a <strong>${op.name} ${op.lastName}</strong> (${op.legajo}) del listado activo.`;
      document.getElementById('modal-delete')?.classList.remove('hidden');
      document.getElementById('modal-delete')?.classList.add('flex');
    }
  });

  // Confirmar eliminación
  document.getElementById('btn-confirm-delete')?.addEventListener('click', () => {
    if (operatorPendingDelete) {
      operators = operators.filter((o) => o.id !== operatorPendingDelete!.id);
      saveOperators();
      showToast(`Operador ${operatorPendingDelete.name} ${operatorPendingDelete.lastName} eliminado`, 'info');
      operatorPendingDelete = null;
      document.getElementById('modal-delete')?.classList.add('hidden');
      document.getElementById('modal-delete')?.classList.remove('flex');
      updateDashboard();
      renderOperators();
    }
  });

  document.getElementById('btn-cancel-delete')?.addEventListener('click', () => {
    operatorPendingDelete = null;
    document.getElementById('modal-delete')?.classList.add('hidden');
    document.getElementById('modal-delete')?.classList.remove('flex');
  });

  // --- MODAL AGREGAR OPERADOR (ÚNICAMENTE NOMBRE Y APELLIDO) ---
  const openAddModal = () => {
    (document.getElementById('input-add-name') as HTMLInputElement).value = '';
    (document.getElementById('input-add-lastname') as HTMLInputElement).value = '';
    document.getElementById('modal-add-operator')?.classList.remove('hidden');
    document.getElementById('modal-add-operator')?.classList.add('flex');
    (document.getElementById('input-add-name') as HTMLInputElement).focus();
  };

  document.getElementById('btn-open-add')?.addEventListener('click', openAddModal);
  document.getElementById('btn-add-op-header')?.addEventListener('click', openAddModal);

  const closeAddModal = () => {
    document.getElementById('modal-add-operator')?.classList.add('hidden');
    document.getElementById('modal-add-operator')?.classList.remove('flex');
  };
  document.getElementById('btn-close-add-modal')?.addEventListener('click', closeAddModal);
  document.getElementById('btn-cancel-add')?.addEventListener('click', closeAddModal);

  document.getElementById('form-add-operator')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('input-add-name') as HTMLInputElement;
    const lastNameInput = document.getElementById('input-add-lastname') as HTMLInputElement;

    const name = nameInput.value.trim();
    const lastName = lastNameInput.value.trim();
    if (!name || !lastName) return;

    // Generar legajo correlativo automáticamente
    const existingNums = operators
      .map((o) => parseInt(o.legajo.replace(/\D/g, ''), 10))
      .filter((n) => !isNaN(n));
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 330;
    const generatedLegajo = `OP-${nextNum}`;

    const newOp: Operator = {
      id: `op-${Date.now()}`,
      name,
      lastName,
      legajo: generatedLegajo,
      status: 'DISPONIBLE',
      lunchStartTime: null,
      avatarColor: 'from-blue-600 to-indigo-700',
    };

    operators.unshift(newOp);
    saveOperators();
    closeAddModal();
    updateDashboard();
    renderOperators();
    showToast(`Operador ${newOp.name} ${newOp.lastName} incorporado (${newOp.legajo})`, 'success');
  });

  // --- MODAL CONFIGURACIÓN DE PARÁMETROS ---
  const openConfigModal = () => {
    const slider = document.getElementById('slider-capacity') as HTMLInputElement;
    const sliderVal = document.getElementById('slider-capacity-val');
    if (slider) slider.value = config.maxSimultaneousBreaks.toString();
    if (sliderVal) sliderVal.textContent = config.maxSimultaneousBreaks.toString();

    // Actualizar botones de minutos
    document.querySelectorAll('.btn-mins-option').forEach((btn) => {
      const mins = parseInt(btn.getAttribute('data-mins') || '30', 10);
      if (mins === config.maxLunchMinutes) {
        btn.className = 'btn-mins-option py-2 text-xs font-bold rounded-xl border bg-amber-600 text-white border-amber-700 shadow-xs cursor-pointer';
      } else {
        btn.className = 'btn-mins-option py-2 text-xs font-bold rounded-xl border bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 cursor-pointer';
      }
    });

    document.getElementById('modal-config')?.classList.remove('hidden');
    document.getElementById('modal-config')?.classList.add('flex');
  };

  document.getElementById('btn-open-config')?.addEventListener('click', openConfigModal);
  document.getElementById('btn-banner-adjust')?.addEventListener('click', openConfigModal);

  const closeConfigModal = () => {
    document.getElementById('modal-config')?.classList.add('hidden');
    document.getElementById('modal-config')?.classList.remove('flex');
  };
  document.getElementById('btn-close-config-modal')?.addEventListener('click', closeConfigModal);

  document.getElementById('slider-capacity')?.addEventListener('input', (e) => {
    const val = (e.target as HTMLInputElement).value;
    document.getElementById('slider-capacity-val')!.textContent = val;
  });

  document.querySelectorAll('.btn-mins-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mins = parseInt(btn.getAttribute('data-mins') || '30', 10);
      config.maxLunchMinutes = mins;
      document.querySelectorAll('.btn-mins-option').forEach((b) => {
        b.className = 'btn-mins-option py-2 text-xs font-bold rounded-xl border bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 cursor-pointer';
      });
      btn.className = 'btn-mins-option py-2 text-xs font-bold rounded-xl border bg-amber-600 text-white border-amber-700 shadow-xs cursor-pointer';
    });
  });

  document.getElementById('btn-save-config')?.addEventListener('click', () => {
    const slider = document.getElementById('slider-capacity') as HTMLInputElement;
    config.maxSimultaneousBreaks = parseInt(slider.value, 10) || 3;
    saveConfig();
    closeConfigModal();
    updateDashboard();
    renderOperators();
    renderRecords();
    showToast('Parámetros de supervisión actualizados', 'success');
  });

  // --- EXPORTAR CSV ---
  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    if (records.length === 0) {
      alert('No hay registros de almuerzo en la bitácora de hoy para exportar.');
      return;
    }

    const headers = ['Legajo', 'Operador', 'Hora Salida', 'Hora Regreso', 'Duración Total (min)', 'Estado de Cumplimiento'];
    const rows = records.map((r) => [
      `"${r.legajo}"`,
      `"${r.operatorName}"`,
      `"${new Date(r.startTime).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}"`,
      `"${new Date(r.endTime).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}"`,
      r.durationMinutes,
      r.wasExceeded ? 'EXCEDIDO' : 'A TIEMPO',
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `call_center_almuerzos_rio_tercero_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Reporte CSV descargado con éxito', 'success');
  });

  // --- REINICIAR BITÁCORA ---
  document.getElementById('btn-clear-records')?.addEventListener('click', () => {
    document.getElementById('modal-clear-records')?.classList.remove('hidden');
    document.getElementById('modal-clear-records')?.classList.add('flex');
  });

  document.getElementById('btn-confirm-clear')?.addEventListener('click', () => {
    records = [];
    saveRecords();
    document.getElementById('modal-clear-records')?.classList.add('hidden');
    document.getElementById('modal-clear-records')?.classList.remove('flex');
    renderRecords();
    updateDashboard();
    showToast('Bitácora diaria de recesos reiniciada', 'info');
  });

  document.getElementById('btn-cancel-clear')?.addEventListener('click', () => {
    document.getElementById('modal-clear-records')?.classList.add('hidden');
    document.getElementById('modal-clear-records')?.classList.remove('flex');
  });

  // --- CONTROL DE SONIDO ---
  document.getElementById('btn-sound-toggle')?.addEventListener('click', () => {
    config.soundEnabled = !config.soundEnabled;
    saveConfig();
    const btn = document.getElementById('btn-sound-toggle');
    if (config.soundEnabled) {
      btn?.classList.add('text-cyan-300');
      btn?.classList.remove('text-slate-500');
      showToast('Sonidos activados', 'info');
    } else {
      btn?.classList.remove('text-cyan-300');
      btn?.classList.add('text-slate-500');
      showToast('Sonidos desactivados', 'info');
    }
  });
});
