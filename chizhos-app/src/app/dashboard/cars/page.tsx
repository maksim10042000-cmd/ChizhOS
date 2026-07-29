import Topbar from "@/components/Topbar";
import CarsView from "@/components/CarsView";
import { currentContext } from "@/lib/current";
import { getScopedDrivers } from "@/lib/data/repo";

export const dynamic = "force-dynamic";

export default async function CarsPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const { session, fleet } = await currentContext("cars");
  const drivers = await getScopedDrivers(session);
  const parks = fleet.parks.map((p) => ({ id: p.id, name: p.name }));
  const f = typeof searchParams?.f === "string" ? searchParams.f : "all";

  return (
    <>
      <Topbar title="Автомобили" sub="Управление и контроль оплаты" />
      <div className="content">
        <CarsView
          cars={fleet.cars}
          parks={parks}
          drivers={drivers.map((d) => ({ id: d.id, fullName: d.fullName, parkId: d.parkId }))}
          initialFilter={f}
          isAdmin={session.role === "admin"}
          // Процент меняют администратор и менеджер парка; обычный пользователь только смотрит.
          canEditPercent={session.role === "admin" || session.role === "manager"}
          globalPercent={fleet.globalManagerPercent}
        />
      </div>
    </>
  );
}
