"use client";

import { useState, useTransition } from "react";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import { addParkAction, renameParkAction, deleteParkAction } from "@/lib/actions";

export interface ParkRow {
  id: string;
  name: string;
  on: number;
  idle: number;
  users: number;
}

function ParkRowEditor({ park }: { park: ParkRow }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const total = park.on + park.idle;

  return (
    <div className="park-row">
      <input
        className="park-input"
        defaultValue={park.name}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (!v || v === park.name) {
            e.target.value = park.name;
            return;
          }
          start(async () => {
            try {
              await renameParkAction(park.id, v);
              setErr("");
            } catch (ex) {
              setErr(ex instanceof Error ? ex.message : "Ошибка");
            }
          });
        }}
      />
      <span className="muted park-meta">
        {total} авто{park.users > 0 ? ` • ${park.users} польз.` : ""}
      </span>
      <button
        className="doc-btn del"
        disabled={pending}
        onClick={() => {
          if (window.confirm(`Удалить парк «${park.name}»?`)) {
            start(async () => {
              try {
                await deleteParkAction(park.id);
                setErr("");
              } catch (ex) {
                setErr(ex instanceof Error ? ex.message : "Ошибка");
              }
            });
          }
        }}
      >
        Удалить
      </button>
      {err && <div className="form-err park-err">{err}</div>}
    </div>
  );
}

export default function ParksEditor({ parks }: { parks: ParkRow[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  function create() {
    if (!name.trim()) {
      setErr("Введите название");
      return;
    }
    start(async () => {
      try {
        await addParkAction(name);
        setName("");
        setErr("");
        setOpen(false);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Ошибка");
      }
    });
  }

  return (
    <div className="card">
      <div className="card-title">
        Автопарки <span className="chip b">{parks.length}</span>
      </div>

      {parks.length === 0 ? (
        <EmptyState
          compact
          icon="car"
          title="Автопарков ещё нет"
          hint="Автопарк — это подразделение, к которому привязываются автомобили, водители и пользователи. Создайте хотя бы один."
          action={<button className="btn" onClick={() => setOpen(true)}>Создать первый автопарк</button>}
        />
      ) : (
        <>
          {parks.map((p) => <ParkRowEditor key={p.id} park={p} />)}
          <button className="btn" style={{ marginTop: 14 }} onClick={() => setOpen(true)}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span> Добавить парк
          </button>
          <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            Название можно изменить прямо в поле — оно обновится во всех разделах.
            Удалить парк можно, только если в нём нет автомобилей и пользователей.
          </div>
        </>
      )}

      {open && (
        <Modal
          title="Новый автопарк"
          subtitle="Появится во всех списках, фильтрах и аналитике"
          onClose={() => setOpen(false)}
        >
          <div className="field">
            <label>Название парка *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Парк №1"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") create(); }}
            />
          </div>
          {err && <div className="form-err">{err}</div>}
          <div className="form-actions">
            <button className="btn ghost" onClick={() => setOpen(false)}>Отмена</button>
            <button className="btn" disabled={pending} onClick={create}>
              {pending ? "…" : "Создать парк"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
