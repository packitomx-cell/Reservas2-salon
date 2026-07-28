import React, { useState, useEffect, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { Plus, X, Trash2, Pencil, ChevronLeft, ChevronRight, Landmark, Clock, User, AlertCircle } from "lucide-react";

const PALETTE = [
  "#2F4C74", "#B8863B", "#5F7A5B", "#8B5E3C",
  "#6B4C6B", "#55707A", "#9A6A3C", "#4C5B6B",
];

const DEFAULT_ROOMS = [
  { id: "r1", name: "Auditorio principal (abajo)", color: PALETTE[0] },
  { id: "r2", name: "Auditorio principal (arriba)", color: PALETTE[1] },
  { id: "r3", name: "Sala de ancianos (arriba)", color: PALETTE[2] },
  { id: "r4", name: "Sala de ancianos (abajo)", color: PALETTE[3] },
  { id: "r5", name: "Sala auxiliar B (arriba)", color: PALETTE[4] },
  { id: "r6", name: "Sala auxiliar B (abajo)", color: PALETTE[5] },
  { id: "r7", name: "Sala auxiliar C (arriba)", color: PALETTE[6] },
  { id: "r8", name: "Sala auxiliar C (abajo)", color: PALETTE[7] },
];

const DAY_NAMES_SHORT = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function pad(n) { return String(n).padStart(2, "0"); }
function dateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}
function addDays(d, n) { const nd = new Date(d); nd.setDate(nd.getDate() + n); return nd; }
function isToday(d) { const t = new Date(); return dateKey(d) === dateKey(t); }
function genId(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

const emptyForm = { id: null, roomId: "", date: "", startTime: "09:00", endTime: "10:00", title: "", person: "", notes: "", pin: "" };

const DATA_DOC = doc(db, "appData", "main");

export default function App() {
  const [rooms, setRooms] = useState(DEFAULT_ROOMS);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [filterRoomId, setFilterRoomId] = useState(null);
  const [confirmDeleteRoomId, setConfirmDeleteRoomId] = useState(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [showAddRoom, setShowAddRoom] = useState(false);

  const [modal, setModal] = useState(null);
  const [formError, setFormError] = useState("");
  const [pinPrompt, setPinPrompt] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(
      DATA_DOC,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setRooms(data.rooms && data.rooms.length ? data.rooms : DEFAULT_ROOMS);
          setReservations(data.reservations || []);
        } else {
          setDoc(DATA_DOC, { rooms: DEFAULT_ROOMS, reservations: [] }).catch(() => setSaveError(true));
        }
        setLoading(false);
      },
      () => {
        setSaveError(true);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const persist = useCallback(async (nextRooms, nextReservations) => {
    try {
      await setDoc(DATA_DOC, { rooms: nextRooms, reservations: nextReservations });
      setSaveError(false);
    } catch (e) {
      setSaveError(true);
    }
  }, []);

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekLabel = (() => {
    const a = weekDates[0], b = weekDates[6];
    if (a.getMonth() === b.getMonth()) {
      return `${a.getDate()} – ${b.getDate()} de ${MONTH_NAMES[b.getMonth()]}, ${b.getFullYear()}`;
    }
    return `${a.getDate()} de ${MONTH_NAMES[a.getMonth()]} – ${b.getDate()} de ${MONTH_NAMES[b.getMonth()]}, ${b.getFullYear()}`;
  })();

  function roomById(id) { return rooms.find((r) => r.id === id); }

  function openNewModal(date) {
    setFormError("");
    setModal({ ...emptyForm, date: dateKey(date), roomId: filterRoomId || rooms[0]?.id || "" });
  }
  function openEditModal(res) {
    setFormError("");
    setModal({ ...res });
  }
  function closeModal() { setModal(null); setFormError(""); }

  function overlaps(a, b) { return a.startTime < b.endTime && b.startTime < a.endTime; }

  async function saveReservation() {
    if (!modal.roomId || !modal.date || !modal.startTime || !modal.endTime || !modal.title.trim()) {
      setFormError("Completa sala, fecha, horario y motivo.");
      return;
    }
    if (!/^\d{4}$/.test(modal.pin || "")) {
      setFormError("El PIN debe ser de 4 dígitos numéricos. Lo vas a necesitar para cancelar esta reserva.");
      return;
    }
    if (modal.startTime >= modal.endTime) {
      setFormError("La hora de término debe ser posterior a la de inicio.");
      return;
    }
    const conflict = reservations.find(
      (r) => r.id !== modal.id && r.roomId === modal.roomId && r.date === modal.date && overlaps(r, modal)
    );
    if (conflict) {
      setFormError(`Esa sala ya está reservada de ${conflict.startTime} a ${conflict.endTime} (${conflict.title}).`);
      return;
    }
    let next;
    if (modal.id) {
      next = reservations.map((r) => (r.id === modal.id ? { ...modal } : r));
    } else {
      next = [...reservations, { ...modal, id: genId("res") }];
    }
    setReservations(next);
    closeModal();
    await persist(rooms, next);
  }

  async function deleteReservation(id) {
    const next = reservations.filter((r) => r.id !== id);
    setReservations(next);
    await persist(rooms, next);
  }

  function attemptEdit(res) {
    setPinPrompt({ id: res.id, value: "", error: "", action: "edit" });
  }

  function attemptDelete(res) {
    setPinPrompt({ id: res.id, value: "", error: "", action: "delete" });
  }

  async function confirmPin() {
    const res = reservations.find((r) => r.id === pinPrompt.id);
    if (!res) { setPinPrompt(null); return; }
    if (pinPrompt.value !== res.pin) {
      setPinPrompt({ ...pinPrompt, error: "PIN incorrecto. Solo quien creó la reserva puede editarla o cancelarla." });
      return;
    }
    if (pinPrompt.action === "edit") {
      setPinPrompt(null);
      openEditModal(res);
    } else {
      await deleteReservation(res.id);
      setPinPrompt(null);
    }
  }

  async function addRoom() {
    const name = newRoomName.trim();
    if (!name) return;
    const color = PALETTE[rooms.length % PALETTE.length];
    const next = [...rooms, { id: genId("room"), name, color }];
    setRooms(next);
    setNewRoomName("");
    setShowAddRoom(false);
    await persist(next, reservations);
  }

  async function deleteRoom(id) {
    const nextRooms = rooms.filter((r) => r.id !== id);
    const nextRes = reservations.filter((r) => r.roomId !== id);
    setRooms(nextRooms);
    setReservations(nextRes);
    setConfirmDeleteRoomId(null);
    if (filterRoomId === id) setFilterRoomId(null);
    await persist(nextRooms, nextRes);
  }

  const reservationsByDate = (dk) =>
    reservations.filter((r) => r.date === dk).sort((a, b) => (a.startTime < b.startTime ? -1 : 1));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-400 text-sm">Cargando horario…</p>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "#F4F5F1", minHeight: "100vh", color: "#23282E" }}>
      <header style={{ backgroundColor: "#1F3350" }} className="px-4 py-5 sm:px-8">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <div style={{ backgroundColor: "#B8863B" }} className="rounded-full p-2 flex items-center justify-center shrink-0">
            <Landmark size={20} color="#1F3350" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-white text-xl sm:text-2xl font-medium leading-tight">
              Salón del Reino, San Ysidro, CA
            </h1>
            <p className="text-gray-300 text-xs sm:text-sm">Horario compartido de salas y auditorios</p>
          </div>
        </div>
      </header>

      {saveError && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-800 flex items-center justify-center gap-2">
          <AlertCircle size={15} /> No se pudo guardar el último cambio. Verifica tu conexión e inténtalo de nuevo.
        </div>
      )}

      <main className="max-w-6xl mx-auto px-3 sm:px-8 py-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-2 rounded-lg bg-white shadow-sm hover:bg-gray-50 border border-gray-200" aria-label="Semana anterior">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-2 rounded-lg bg-white shadow-sm hover:bg-gray-50 border border-gray-200" aria-label="Semana siguiente">
              <ChevronRight size={18} />
            </button>
            <span className="text-lg font-medium ml-1">{weekLabel}</span>
          </div>
          <button onClick={() => setWeekStart(getMonday(new Date()))} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50">
            Hoy
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-6">
          {rooms.map((room) => {
            const isDimmed = filterRoomId && filterRoomId !== room.id;
            const isConfirming = confirmDeleteRoomId === room.id;
            if (isConfirming) {
              const count = reservations.filter((r) => r.roomId === room.id).length;
              return (
                <div key={room.id} className="flex items-center gap-2 bg-white border border-red-200 rounded-full pl-3 pr-1.5 py-1 text-xs">
                  <span>¿Eliminar "{room.name}"{count ? ` y sus ${count} reserva(s)` : ""}?</span>
                  <button onClick={() => deleteRoom(room.id)} className="px-2 py-0.5 rounded-full bg-red-600 text-white">Sí</button>
                  <button onClick={() => setConfirmDeleteRoomId(null)} className="px-2 py-0.5 rounded-full bg-gray-100">No</button>
                </div>
              );
            }
            return (
              <div
                key={room.id}
                onClick={() => setFilterRoomId(filterRoomId === room.id ? null : room.id)}
                style={{ borderColor: room.color, backgroundColor: filterRoomId === room.id ? room.color : "white", opacity: isDimmed ? 0.45 : 1 }}
                className="group flex items-center gap-1.5 border-2 rounded-full pl-3 pr-2 py-1 text-xs sm:text-sm cursor-pointer select-none transition-opacity"
              >
                <span style={{ color: filterRoomId === room.id ? "white" : "#23282E" }} className="font-medium">{room.name}</span>
                <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteRoomId(room.id); }} style={{ color: filterRoomId === room.id ? "white" : "#9CA3AF" }} className="hover:opacity-70" aria-label={`Eliminar ${room.name}`}>
                  <X size={13} />
                </button>
              </div>
            );
          })}

          {showAddRoom ? (
            <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-full pl-3 pr-1 py-1">
              <input autoFocus value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRoom()} placeholder="Nombre de la sala" className="text-sm outline-none w-32" />
              <button onClick={addRoom} className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: "#1F3350", color: "white" }}>Agregar</button>
              <button onClick={() => { setShowAddRoom(false); setNewRoomName(""); }} className="p-1 text-gray-400"><X size={14} /></button>
            </div>
          ) : (
            <button onClick={() => setShowAddRoom(true)} className="flex items-center gap-1 text-xs sm:text-sm border-2 border-dashed border-gray-300 rounded-full px-3 py-1 text-gray-500 hover:border-gray-400">
              <Plus size={13} /> Sala
            </button>
          )}
        </div>

        <div className="overflow-x-auto pb-4">
          <div className="grid grid-cols-7 gap-3 min-w-full" style={{ minWidth: "980px" }}>
            {weekDates.map((date) => {
              const dk = dateKey(date);
              const dayRes = reservationsByDate(dk);
              const todayFlag = isToday(date);
              return (
                <div key={dk} className="flex flex-col">
                  <div className="rounded-t-lg px-3 py-2 flex items-baseline justify-between" style={{ backgroundColor: todayFlag ? "#1F3350" : "#E7E5DF" }}>
                    <span className="text-xs font-semibold tracking-wide" style={{ color: todayFlag ? "#B8863B" : "#6B6B63" }}>
                      {DAY_NAMES_SHORT[date.getDay() === 0 ? 6 : date.getDay() - 1]}
                    </span>
                    <span style={{ color: todayFlag ? "white" : "#23282E" }} className="text-lg font-medium">{date.getDate()}</span>
                  </div>

                  <div className="bg-white border border-gray-200 border-t-0 rounded-b-lg flex-1 p-2 flex flex-col gap-2 min-h-64">
                    {dayRes.length === 0 && <p className="text-xs text-gray-300 italic mt-2 text-center">Sin reservas</p>}
                    {dayRes.map((res) => {
                      const room = roomById(res.roomId);
                      const dimmed = filterRoomId && filterRoomId !== res.roomId;
                      return (
                        <div key={res.id} style={{ borderLeftColor: room?.color || "#ccc", opacity: dimmed ? 0.35 : 1 }} className="border-l-4 bg-gray-50 rounded-md p-2 text-xs">
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-medium text-gray-700 flex items-center gap-1">
                              <Clock size={11} /> {res.startTime}–{res.endTime}
                            </span>
                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => attemptEdit(res)} className="text-gray-400 hover:text-gray-700"><Pencil size={12} /></button>
                              <button onClick={() => attemptDelete(res)} className="text-gray-400 hover:text-red-600"><Trash2 size={12} /></button>
                            </div>
                          </div>
                          <p className="font-medium mt-1">{res.title}</p>
                          <p className="text-gray-500 mt-0.5" style={{ color: room?.color }}>{room?.name}</p>
                          {res.person && (
                            <p className="text-gray-400 mt-0.5 flex items-center gap-1">
                              <User size={10} /> Cong. {res.person}
                            </p>
                          )}
                        </div>
                      );
                    })}
                    <button onClick={() => openNewModal(date)} className="mt-auto flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-gray-700 border border-dashed border-gray-200 rounded-md py-1.5">
                      <Plus size={12} /> Agregar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {modal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">{modal.id ? "Editar reserva" : "Nueva reserva"}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Sala</label>
                <select value={modal.roomId} onChange={(e) => setModal({ ...modal, roomId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Fecha</label>
                <input type="date" value={modal.date} onChange={(e) => setModal({ ...modal, date: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">Inicio</label>
                  <input type="time" value={modal.startTime} onChange={(e) => setModal({ ...modal, startTime: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">Término</label>
                  <input type="time" value={modal.endTime} onChange={(e) => setModal({ ...modal, endTime: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Motivo</label>
                <input value={modal.title} onChange={(e) => setModal({ ...modal, title: e.target.value })} placeholder="Ej. Ensayo de discurso, reunión de servicio…" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Congregación que reserva (opcional)</label>
                <input value={modal.person} onChange={(e) => setModal({ ...modal, person: e.target.value })} placeholder="Ej. Congregación San Ysidro" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">PIN de 4 dígitos (lo vas a necesitar para cancelar)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={modal.pin}
                  onChange={(e) => setModal({ ...modal, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                  placeholder="Ej. 1234"
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                />
              </div>

              {formError && (
                <p className="text-xs text-red-600 flex items-start gap-1">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" /> {formError}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={saveReservation} style={{ backgroundColor: "#1F3350" }} className="flex-1 text-white rounded-lg py-2 text-sm font-medium">Guardar</button>
                <button onClick={closeModal} className="px-4 rounded-lg border border-gray-300 text-sm">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pinPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xs p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-medium">{pinPrompt.action === "edit" ? "Editar reserva" : "Cancelar reserva"}</h2>
              <button onClick={() => setPinPrompt(null)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <p className="text-xs text-gray-500 mb-3">Ingresa el PIN con el que se creó esta reserva.</p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              autoFocus
              value={pinPrompt.value}
              onChange={(e) => setPinPrompt({ ...pinPrompt, value: e.target.value.replace(/\D/g, "").slice(0, 4), error: "" })}
              onKeyDown={(e) => e.key === "Enter" && confirmPin()}
              placeholder="PIN"
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            />
            {pinPrompt.error && <p className="text-xs text-red-600 mt-1">{pinPrompt.error}</p>}
            <div className="flex gap-2 pt-3">
              <button
                onClick={confirmPin}
                style={{ backgroundColor: pinPrompt.action === "edit" ? "#1F3350" : "#B91C1C" }}
                className="flex-1 text-white rounded-lg py-2 text-sm font-medium"
              >
                {pinPrompt.action === "edit" ? "Continuar" : "Cancelar reserva"}
              </button>
              <button onClick={() => setPinPrompt(null)} className="px-4 rounded-lg border border-gray-300 text-sm">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      <footer className="text-center text-xs text-gray-400 py-6">
        Los datos de este horario son compartidos: cualquiera con el enlace puede verlos y editarlos.
      </footer>
    </div>
  );
}
