import Topbar from "@/components/Topbar";
import Icon from "@/components/Icon";
import EmptyState from "@/components/EmptyState";
import { currentContext } from "@/lib/current";
import { getDismissed } from "@/lib/data/repo";
import { buildNotifications } from "@/lib/domain/notifications";
import PayButton from "@/components/actions/PayButton";
import { DismissButton, ClearAllButton } from "@/components/actions/NotifButtons";
import type { DerivedCar, Severity } from "@/lib/types";

export const dynamic = "force-dynamic";

const COL: Record<Severity, [string, string, string]> = {
  critical: ["#fdecef", "#e11d48", "shield"],
  warning: ["#fef6e7", "#d97706", "bell"],
  info: ["#eef3ff", "#2563eb", "bell"],
};

export default async function NotificationsPage() {
  const { fleet } = await currentContext("notifications");
  const dismissed = await getDismissed();
  const list = buildNotifications(fleet.cars).filter((n) => !dismissed.includes(n.id));
  const carsById = new Map<string, DerivedCar>(fleet.cars.map((c) => [c.id, c]));

  return (
    <>
      <Topbar title="Уведомления" sub="События, требующие внимания" />
      <div className="content">
        <div className="grid notif-list">
          {list.length > 0 && (
            <div className="toolbar" style={{ marginBottom: 0 }}>
              <div className="card-title" style={{ margin: 0 }}>Активные уведомления — {list.length}</div>
              <ClearAllButton ids={list.map((n) => n.id)} />
            </div>
          )}

          {list.length === 0 && (
            <EmptyState
              icon="bell"
              title="Нет активных уведомлений"
              hint={
                fleet.cars.length === 0
                  ? "Уведомления появятся, когда в системе будут автомобили: просрочки оплаты, приближение ТО, окончание страховки и простой."
                  : "Всё в порядке: просрочек, приближающихся ТО и заканчивающихся полисов нет."
              }
            />
          )}

          {list.map((n) => {
            const [bg, fg, ico] = COL[n.severity];
            const car = n.carId ? carsById.get(n.carId) : undefined;
            return (
              <div key={n.id} className="notif-card">
                <div className="notif-ico" style={{ background: bg, color: fg }}>
                  <Icon name={ico} size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {n.severity === "critical" ? "🔴 " : "🟡 "}
                    {n.title}
                  </div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>{n.body}</div>
                </div>
                {n.type === "overdue" && car ? <PayButton carId={car.id} overdue={car.overdue} /> : null}
                <DismissButton id={n.id} />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
