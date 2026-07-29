import Sidebar from "@/components/Sidebar";
import { requireSession } from "@/lib/current";
import { getScopedFleet, getDismissed, getSettings } from "@/lib/data/repo";
import { notifCounts } from "@/lib/domain/notifications";

// Данные зависят от сессии и содержимого БД — статически не кешируются.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const [fleet, dismissed, settings] = await Promise.all([
    getScopedFleet(session),
    getDismissed(),
    getSettings(),
  ]);
  const counts = notifCounts(fleet.cars, dismissed);
  const parkName = session.parkId
    ? fleet.parks.find((p) => p.id === session.parkId)?.name ?? null
    : null;

  return (
    <div className="layout">
      <Sidebar
        session={session}
        counts={counts}
        orgName={settings.orgName}
        parkName={parkName}
      />
      <div className="main">{children}</div>
    </div>
  );
}
