import Topbar from "@/components/Topbar";
import ParksEditor from "@/components/actions/ParksEditor";
import { requireAdmin } from "@/lib/current";
import { getScopedFleet } from "@/lib/data/repo";
import { getUsers } from "@/lib/data/repo";

export const dynamic = "force-dynamic";

export default async function AdminParksPage() {
  const session = await requireAdmin();
  const [fleet, users] = await Promise.all([getScopedFleet(session), getUsers()]);

  const parks = fleet.parks.map((p) => ({
    id: p.id,
    name: p.name,
    on: p.on,
    idle: p.idle,
    users: users.filter((u) => u.parkId === p.id).length,
  }));

  return (
    <>
      <Topbar title="Автопарки" sub="Структура компании" />
      <div className="content">
        <div className="admin-narrow">
          <ParksEditor parks={parks} />
        </div>
      </div>
    </>
  );
}
