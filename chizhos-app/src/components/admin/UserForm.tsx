"use client";

import { useState, useTransition } from "react";
import Modal from "@/components/Modal";
import { createUserAction, updateUserAction } from "@/lib/actions";
import {
  DEFAULT_USER_SECTIONS,
  ROLE_HINTS,
  ROLE_LABELS,
  SECTIONS,
  type AppUser,
  type Park,
  type Role,
  type Section,
} from "@/lib/types";

const ROLES: Role[] = ["admin", "manager", "user"];

/**
 * Создание и редактирование учётной записи.
 * Пароль задаётся только при создании — сменить его можно отдельной кнопкой,
 * чтобы случайное сохранение формы не сбрасывало пароль пользователя.
 */
export default function UserForm({
  parks,
  user,
  onClose,
}: {
  parks: Park[];
  user?: AppUser;
  onClose: () => void;
}) {
  const isEdit = !!user;
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");

  const [login, setLogin] = useState(user?.login ?? "");
  const [name, setName] = useState(user?.name ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(user?.role ?? "user");
  const [parkId, setParkId] = useState<string>(user?.parkId ?? parks[0]?.id ?? "");
  const [permissions, setPermissions] = useState<Section[]>(
    user?.permissions.length ? user.permissions : DEFAULT_USER_SECTIONS
  );

  const togglePermission = (key: Section) =>
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );

  function submit() {
    if (!login.trim()) {
      setErr("Введите логин");
      return;
    }
    if (role !== "admin" && !parkId) {
      setErr("Выберите автопарк — он обязателен для всех, кроме администратора");
      return;
    }
    if (role === "user" && permissions.length === 0) {
      setErr("Отметьте хотя бы один доступный раздел");
      return;
    }
    setErr("");

    start(async () => {
      try {
        if (isEdit) {
          await updateUserAction(user!.id, {
            login,
            name,
            role,
            parkId: role === "admin" ? null : parkId,
            permissions,
          });
        } else {
          await createUserAction({
            login,
            password,
            name,
            role,
            parkId: role === "admin" ? null : parkId,
            permissions,
          });
        }
        onClose();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Не удалось сохранить");
      }
    });
  }

  return (
    <Modal
      title={isEdit ? `Учётная запись: ${user!.login}` : "Новый пользователь"}
      subtitle="Роль определяет права, автопарк — какие данные будут видны"
      onClose={onClose}
    >
      <div className="form-grid">
        <div className="field">
          <label>Логин *</label>
          <input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="ivanov"
            autoComplete="off"
          />
          <span className="field-hint">Латинские буквы, цифры и символы . _ - @</span>
        </div>
        <div className="field">
          <label>Имя / ФИО</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Иванов Иван" />
        </div>

        {!isEdit && (
          <div className="field">
            <label>Пароль *</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="не короче 6 символов"
              autoComplete="new-password"
            />
            <span className="field-hint">Передайте пароль пользователю — он сможет сменить его сам</span>
          </div>
        )}

        <div className="field">
          <label>Роль *</label>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <span className="field-hint">{ROLE_HINTS[role]}</span>
        </div>

        {role !== "admin" && (
          <div className="field">
            <label>Автопарк *</label>
            <select value={parkId} onChange={(e) => setParkId(e.target.value)}>
              <option value="">— выберите парк —</option>
              {parks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {parks.length === 0 && (
              <span className="field-hint">Парков ещё нет — создайте их на вкладке «Автопарки»</span>
            )}
          </div>
        )}
      </div>

      {role === "user" && (
        <div className="perm-block">
          <div className="perm-title">Доступные разделы</div>
          <div className="perm-grid">
            {SECTIONS.map((s) => (
              <label key={s.key} className="perm-item">
                <input
                  type="checkbox"
                  checked={permissions.includes(s.key)}
                  onChange={() => togglePermission(s.key)}
                />
                <span>{s.label}</span>
              </label>
            ))}
          </div>
          <div className="field-hint" style={{ marginTop: 8 }}>
            Разделы, которые не отмечены, не появятся в меню и будут недоступны по прямой ссылке.
          </div>
        </div>
      )}

      {role === "manager" && (
        <div className="notice" style={{ marginTop: 16 }}>
          Менеджеру парка доступны все разделы, но только по своему автопарку.
        </div>
      )}
      {role === "admin" && (
        <div className="notice" style={{ marginTop: 16 }}>
          Администратор видит все парки и может управлять пользователями и настройками.
        </div>
      )}

      {err && <div className="form-err">{err}</div>}

      <div className="form-actions">
        <button className="btn ghost" onClick={onClose}>Отмена</button>
        <button className="btn" disabled={pending} onClick={submit}>
          {pending ? "Сохранение…" : isEdit ? "Сохранить изменения" : "Создать пользователя"}
        </button>
      </div>
    </Modal>
  );
}
