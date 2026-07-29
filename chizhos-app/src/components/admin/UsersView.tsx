"use client";

import { useState, useTransition } from "react";
import UserForm from "@/components/admin/UserForm";
import PasswordForm from "@/components/admin/PasswordForm";
import EmptyState from "@/components/EmptyState";
import { deleteUserAction, updateUserAction } from "@/lib/actions";
import { ROLE_LABELS, SECTIONS, sectionsFor, type AppUser, type Park } from "@/lib/types";

function RoleChip({ user }: { user: AppUser }) {
  const cls = user.role === "admin" ? "role-admin" : user.role === "manager" ? "role-manager" : "role-user";
  return <span className={"role-chip " + cls}>{ROLE_LABELS[user.role]}</span>;
}

function SectionsCell({ user }: { user: AppUser }) {
  if (user.role !== "user") return <span className="muted">все разделы</span>;
  const allowed = sectionsFor(user.role, user.permissions);
  if (allowed.length === SECTIONS.length) return <span className="muted">все разделы</span>;
  return (
    <span className="sec-list">
      {SECTIONS.filter((s) => allowed.includes(s.key)).map((s) => (
        <span key={s.key} className="chip">{s.label}</span>
      ))}
    </span>
  );
}

function RowActions({
  user,
  isSelf,
  onEdit,
  onPassword,
}: {
  user: AppUser;
  isSelf: boolean;
  onEdit: () => void;
  onPassword: () => void;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");

  function toggleBlock() {
    const next = !user.blocked;
    const q = next
      ? `Заблокировать «${user.login}»? Пользователь не сможет войти, активные сессии будут завершены.`
      : `Разблокировать «${user.login}»?`;
    if (!window.confirm(q)) return;
    start(async () => {
      try {
        await updateUserAction(user.id, { blocked: next });
        setErr("");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Ошибка");
      }
    });
  }

  function remove() {
    if (!window.confirm(`Удалить пользователя «${user.login}»? Действие нельзя отменить.`)) return;
    start(async () => {
      try {
        await deleteUserAction(user.id);
        setErr("");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Ошибка");
      }
    });
  }

  return (
    <div className="user-actions">
      <button className="doc-btn" onClick={onEdit}>Изменить</button>
      <button className="doc-btn" onClick={onPassword}>Пароль</button>
      <button className="doc-btn" disabled={pending || isSelf} onClick={toggleBlock}
        title={isSelf ? "Нельзя заблокировать себя" : undefined}>
        {user.blocked ? "Разблокировать" : "Блокировать"}
      </button>
      <button className="doc-btn del" disabled={pending || isSelf} onClick={remove}
        title={isSelf ? "Нельзя удалить себя" : undefined}>
        Удалить
      </button>
      {err && <div className="form-err" style={{ marginTop: 6 }}>{err}</div>}
    </div>
  );
}

export default function UsersView({
  users,
  parks,
  currentUserId,
}: {
  users: AppUser[];
  parks: Park[];
  currentUserId: string;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [pwUser, setPwUser] = useState<AppUser | null>(null);
  const parkName = (id: string | null) => (id ? parks.find((p) => p.id === id)?.name ?? "—" : "все парки");

  return (
    <>
      {parks.length === 0 && (
        <div className="notice warn">
          Автопарков ещё нет. Создать можно только администратора — остальным ролям
          обязательно нужен парк. Перейдите на вкладку «Автопарки».
        </div>
      )}

      <div className="toolbar">
        <div className="muted" style={{ fontSize: 13 }}>
          Всего учётных записей: <b>{users.length}</b>
        </div>
        <button className="btn" onClick={() => setCreating(true)}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span> Добавить пользователя
        </button>
      </div>

      {users.length === 0 ? (
        <EmptyState
          icon="users"
          title="Нет пользователей"
          hint="Создайте учётные записи для сотрудников и назначьте каждому роль и автопарк."
        />
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Логин</th><th>Имя</th><th>Роль</th><th>Автопарк</th>
                <th>Разделы</th><th>Статус</th><th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.blocked ? "row-blocked" : undefined}>
                  <td style={{ fontWeight: 700 }}>
                    {u.login}
                    {u.id === currentUserId && <span className="chip b" style={{ marginLeft: 6 }}>вы</span>}
                  </td>
                  <td>{u.name}</td>
                  <td><RoleChip user={u} /></td>
                  <td>{parkName(u.parkId)}</td>
                  <td style={{ whiteSpace: "normal", maxWidth: 280 }}><SectionsCell user={u} /></td>
                  <td>
                    {u.blocked
                      ? <span className="pill r">Заблокирован</span>
                      : <span className="pill g">Активен</span>}
                  </td>
                  <td>
                    <RowActions
                      user={u}
                      isSelf={u.id === currentUserId}
                      onEdit={() => setEditing(u)}
                      onPassword={() => setPwUser(u)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && <UserForm parks={parks} onClose={() => setCreating(false)} />}
      {editing && <UserForm parks={parks} user={editing} onClose={() => setEditing(null)} />}
      {pwUser && <PasswordForm user={pwUser} onClose={() => setPwUser(null)} />}
    </>
  );
}
