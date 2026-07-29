import Topbar from "@/components/Topbar";
import OrgSettings from "@/components/admin/OrgSettings";
import ChangeOwnPassword from "@/components/admin/ChangeOwnPassword";
import { requireAdmin } from "@/lib/current";
import { getScopedFleet, getSettings, getUsers, getScopedDrivers } from "@/lib/data/repo";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const session = await requireAdmin();
  const [fleet, settings, users, drivers] = await Promise.all([
    getScopedFleet(session),
    getSettings(),
    getUsers(),
    getScopedDrivers(session),
  ]);

  const storage = process.env.S3_BUCKET ? "S3/R2: " + process.env.S3_BUCKET : "Диск сервера (public/uploads)";

  return (
    <>
      <Topbar title="Настройки" sub="Организация и параметры системы" />
      <div className="content">
        <div className="grid two-col admin-wide">
          <OrgSettings
            orgName={settings.orgName}
            managerPercent={settings.managerPercent}
          />

          <div className="card">
            <div className="card-title">Состояние системы</div>
            <div className="park"><span className="muted">Автопарков</span><b>{fleet.parks.length}</b></div>
            <div className="park"><span className="muted">Автомобилей</span><b>{fleet.cars.length}</b></div>
            <div className="park"><span className="muted">На линии</span><b>{fleet.onLine}</b></div>
            <div className="park"><span className="muted">Водителей</span><b>{drivers.length}</b></div>
            <div className="park"><span className="muted">Пользователей</span><b>{users.length}</b></div>
            <div className="park"><span className="muted">Хранилище документов</span><b>{storage}</b></div>
          </div>
        </div>

        <div className="admin-narrow" style={{ marginTop: 16 }}>
          <ChangeOwnPassword login={session.login} />
        </div>
      </div>
    </>
  );
}
