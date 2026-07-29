import Sidebar from "@/components/Sidebar";
import AdminTabs from "@/components/AdminTabs";
import { requireAdmin } from "@/lib/current";
import { getScopedFleet, getDismissed, getSettings } from "@/lib/data/repo";
import { notifCounts } from "@/lib/domain/notifications";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Весь раздел /admin доступен только администратору — проверка здесь,
  // поэтому каждой вложенной странице повторять её не нужно.
  const session = await requireAdmin();
  const [fleet, dismissed, settings] = await Promise.all([
    getScopedFleet(session),
    getDismissed(),
    getSettings(),
  ]);

  return (
    <div className="layout">
      <Sidebar
        session={session}
        counts={notifCounts(fleet.cars, dismissed)}
        orgName={settings.orgName}
        parkName={null}
      />
      <div className="main">
        <AdminTabs />
        {children}
      </div>
    </div>
  );
}
