import Topbar from "@/components/Topbar";
import DriversView, { type DriverRow } from "@/components/DriversView";
import { currentContext } from "@/lib/current";
import { getScopedDrivers } from "@/lib/data/repo";
import { discipline } from "@/lib/domain/overdue";
import type { Payment } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DriversPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const { session, fleet } = await currentContext("drivers");
  const drivers = await getScopedDrivers(session);
  const parks = fleet.parks.map((p) => ({ id: p.id, name: p.name }));
  const f = typeof searchParams?.f === "string" ? searchParams.f : "all";

  // Показатели водителя складываются из закреплённых за ним автомобилей.
  const rows: DriverRow[] = drivers.map((d) => {
    const cars = fleet.cars.filter((c) => c.driverId === d.id);
    const payments: Payment[] = cars.flatMap((c) => c.payments);
    return {
      id: d.id,
      name: d.fullName,
      phone: d.phone,
      parkId: d.parkId,
      parkName: d.parkId ? fleet.parkName(d.parkId) : "—",
      cars: cars.map((c) => ({ plate: c.plate, brand: c.brand, model: c.model })),
      incomeMonth: cars.reduce((s, c) => s + c.fin.income.month, 0),
      debt: cars.reduce((s, c) => s + c.fin.debt, 0),
      overdue: cars.reduce((m, c) => Math.max(m, c.overdue), 0),
      discipline: payments.length ? discipline(payments) : null,
      licenseNo: d.licenseNo,
      passport: d.passport,
      address: d.address,
      deposit: d.deposit,
      comment: d.comment,
      active: d.active,
    };
  });

  return (
    <>
      <Topbar title="Водители" sub="Арендаторы и дисциплина оплаты" />
      <div className="content">
        <DriversView
          rows={rows}
          parks={parks}
          initialFilter={f}
          isAdmin={session.role === "admin"}
        />
      </div>
    </>
  );
}
