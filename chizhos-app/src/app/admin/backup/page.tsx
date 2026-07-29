import Topbar from "@/components/Topbar";
import BackupCard from "@/components/actions/BackupCard";
import { requireAdmin } from "@/lib/current";

export const dynamic = "force-dynamic";

export default async function AdminBackupPage() {
  await requireAdmin();

  return (
    <>
      <Topbar title="Резервное копирование" sub="Выгрузка и восстановление данных" />
      <div className="content">
        <div className="admin-narrow">
          <BackupCard />
        </div>
      </div>
    </>
  );
}
