// -------------------- Utilidades --------------------
async function loadJSONWithCache(url, cacheKey){
try {
    const resp = await fetch(url, { cache: 'no-store' });
    if(!resp.ok) throw new Error('HTTP '+resp.status);
    const data = await resp.json();
    localStorage.setItem(cacheKey, JSON.stringify({ data, ts: new Date().toISOString() }));
    return { data, stale:false, ts: new Date() };
} catch (err) {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
    const { data, ts } = JSON.parse(cached);
    return { data, stale:true, ts: new Date(ts) };
    }
    throw err;
}
}

function dayNameToNumber(input){
if (input == null) return null;
const s = String(input).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const map = { 'lunes':1,'lun':1,'martes':2,'mar':2,'miercoles':3,'mie':3,'jueves':4,'jue':4,'viernes':5,'vie':5,'sabado':6,'sab':6,'domingo':7,'dom':7 };
return map[s] ?? null;
}

// "YYYY-MM-DD" o "DD/MM/YYYY" -> Date LOCAL (00:00)
function parseLocalDate(dateStr){
const s = String(dateStr).trim();
if (s.includes('-')) {
    const [y,m,d] = s.split('-').map(Number);
    return new Date(y, m-1, d, 0, 0, 0, 0);
}
if (s.includes('/')) {
    const [d, m, y] = s.split('/').map(Number); // DD/MM/YYYY
    return new Date(y, m-1, d, 0, 0, 0, 0);
}
throw new Error('Formato de fecha no soportado: ' + s);
}

// Crea Date LOCAL combinando fecha + "HH:mm"
function combineLocal(dateStr, timeStr){
const base = parseLocalDate(dateStr);
const [hh,mm] = String(timeStr).trim().split(':').map(Number);
return new Date(base.getFullYear(), base.getMonth(), base.getDate(), hh, mm, 0, 0);
}

// -------------------- Generación de eventos --------------------
function generateRegularEvents(regular, excepciones){
const events = [];
const excluidos = new Set(excepciones.map(e => `${e.ID_Regular}|${e.Fecha}`));

regular.forEach(r => {
    const inicio = parseLocalDate(r.Inicio_Contrato);
    const fin    = parseLocalDate(r.Fin_Contrato);

    const ds = String(r.Dia_Semana ?? '').trim();
    const diaSemana = ds && /^\d+$/.test(ds)
    ? (parseInt(ds,10) === 0 ? 7 : parseInt(ds,10))
    : dayNameToNumber(ds);

    if(!diaSemana || diaSemana < 1 || diaSemana > 7) return;

    const first = new Date(inicio);
    while(((first.getDay() || 7)) !== diaSemana){
    first.setDate(first.getDate()+1);
    if(first > fin) return;
    }

    for(let d = new Date(first); d <= fin; d.setDate(d.getDate()+7)){
    const fechaStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const key = `${r.ID_Regular}|${fechaStr}`;
    if(!excluidos.has(key)){
        events.push({
        id: `${r.ID_Regular}-${fechaStr.replace(/-/g,'')}-${r.Hora_Inicio}`,
        title: `${r.Alumno} • ${r.Curso} (${r.Modalidad})`,
        start: combineLocal(fechaStr, r.Hora_Inicio),
        end:   combineLocal(fechaStr, r.Hora_Final),
        extendedProps: r
        });
    }
    }
});

return events;
}

function generateEventualEvents(eventual){
return eventual.map(r => {
    const fechaStr = String(r.Fecha).trim(); // admite YYYY-MM-DD o DD/MM/YYYY
    return {
    id: r.ID_Evento,
    title: `${r.Alumno} • ${r.Curso} (${r.Modalidad})`,
    start: combineLocal(fechaStr, r.Hora_Inicio),
    end:   combineLocal(fechaStr, r.Hora_Final),
    extendedProps: r
    };
});
}

function formatWeekTitle(start, end){
const startDay = start.getDate();
const endDay = new Date(end.getTime() - 1).getDate();
const monthYear = start.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
return `${startDay} – ${endDay} ${monthYear}`;
}

// -------------------- App --------------------
async function initCalendar(){
const banner = document.getElementById('banner');
try {
    const { data: regular }     = await loadJSONWithCache('/api/regular',  'regular_cache');
    const { data: eventual }    = await loadJSONWithCache('/api/eventual', 'eventual_cache');
    const { data: excepciones } = await loadJSONWithCache('/api/excepcion','excepcion_cache');

    const events = [
    ...generateRegularEvents(regular, excepciones),
    ...generateEventualEvents(eventual)
    ];

    const calendarEl = document.getElementById('calendar');
    const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'timeGridWeek',
    locale: 'es',
    timeZone: 'local',                 // local para evitar desplazamientos
    nowIndicator: true,
    firstDay: 1,
    allDaySlot: false,                 // sin “Todo el día”
    slotMinTime: '06:00:00',
    slotMaxTime: '22:00:00',
    slotLabelFormat: { hour: 'numeric', minute: '2-digit', hour12: false }, // 6:00, 7:00…
    headerToolbar: { left:'prev,next today', center:'title', right:'timeGridWeek,listWeek' },

    // === Ajustes de vista/scroll (sin cambiar el tamaño de slot) ===
    stickyHeaderDates: true,           // encabezados fijos al scrollear
    expandRows: true,                  // calcula bien alturas internas
    contentHeight: 520,                // ~6 horas visibles (ajusta 460–540 si deseas)
    scrollTime: '06:00:00',            // que arranque mostrando las 06:00
    scrollTimeReset: false,            // conserva la posición al cambiar de semana

    events,


    dayHeaderContent: (arg) => {
        const dayName = arg.date.toLocaleDateString('es-ES', { weekday: 'long' }).toUpperCase();
        const date = arg.date.getDate();
        return { html: `${dayName}<br>${date}` };
    },

    datesSet: (info) => {
        const weekTitle = formatWeekTitle(info.view.currentStart, info.view.currentEnd);
        const headerEl = calendarEl.querySelector('.fc-toolbar-title');
        if(headerEl) headerEl.innerHTML = weekTitle;
    },

    eventClassNames: (arg) => {
        const mod = String(arg.event.extendedProps.Modalidad || '').toLowerCase();
        return [
        mod === 'presencial' ? 'event--presencial' : '',
        mod === 'virtual' ? 'event--virtual' : ''
        ];
    },

      // Contenido compacto y centrado
    eventContent: (arg) => {
        const p = arg.event.extendedProps;
        const fmt = (d)=> d.toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit', hour12: false });
        const hora = `${fmt(arg.event.start)} – ${fmt(arg.event.end)}`;
        const html = (arg.view.type === 'listWeek')
        ? `A: ${p.Alumno} | T: ${p.Tutor} | ${hora}`
        : `<div class="evt">
            <div class="evt-row">A: ${p.Alumno}</div>
            <div class="evt-row">T: ${p.Tutor}</div>
            <div class="evt-time">${hora}</div>
            </div>`;
        return { html };
    },

    eventDidMount: (info) => {
        info.el.title = `${info.event.extendedProps.Alumno} • ${info.event.extendedProps.Tutor}`;
    }
    });

    calendar.render();

    // -------- Filtros --------
    const tutors = [...new Set(events.map(e=>e.extendedProps.Tutor))].filter(Boolean);
    const alumnos = [...new Set(events.map(e=>e.extendedProps.Alumno))].filter(Boolean);
    const cursos = [...new Set(events.map(e=>e.extendedProps.Curso))].filter(Boolean);
    const modalidades = [...new Set(events.map(e=>e.extendedProps.Modalidad))].filter(Boolean);

    const fillSelect = (id, arr)=>{
    const sel = document.getElementById(id);
    arr.forEach(v=>{
        const opt = document.createElement('option');
        opt.value=v; opt.textContent=v; sel.appendChild(opt);
    });
    };
    fillSelect('filterTutor', tutors);
    fillSelect('filterAlumno', alumnos);
    fillSelect('filterCurso', cursos);
    fillSelect('filterModalidad', modalidades);

    const eq = (a,b)=> !b || String(a).toLowerCase()===String(b).toLowerCase();

    function applyFilters(){
    const fTutor = document.getElementById('filterTutor').value;
    const fAlumno = document.getElementById('filterAlumno').value;
    const fCurso = document.getElementById('filterCurso').value;
    const fModalidad = document.getElementById('filterModalidad').value;
    const filtered = events.filter(e=> eq(e.extendedProps.Tutor, fTutor)
        && eq(e.extendedProps.Alumno, fAlumno)
        && eq(e.extendedProps.Curso, fCurso)
        && eq(e.extendedProps.Modalidad, fModalidad));
    calendar.removeAllEvents();
    calendar.addEventSource(filtered);
    }

    ['filterTutor','filterAlumno','filterCurso','filterModalidad'].forEach(id=>{
    document.getElementById(id).addEventListener('change', applyFilters);
    });
    document.getElementById('resetFilters').addEventListener('click', ()=>{
    ['filterTutor','filterAlumno','filterCurso','filterModalidad'].forEach(id=> document.getElementById(id).value='');
    applyFilters();
    });

} catch (e) {
    banner.hidden = false;
    banner.textContent = 'Error al cargar datos: ' + e.message;
}
}

initCalendar();
