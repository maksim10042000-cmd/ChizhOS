import Topbar from "@/components/Topbar";
import UsersView from "@/components/admin/UsersView";
import { requireAdmin } from "@/lib/current";
import { getUsers, getAllParks } from "@/lib/data/repo";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await requireAdmin();
  const [users, parks] = await Promise.all([getUsers(), getAllParks()]);

  return (
    <>
      <Topbar title="Пользователи" sub="Учётные записи, роли и доступ к паркам" />
      <div className="content">
        <UsersView users={users} parks={parks} currentUserId={session.userId} />
      </div>
    </>
  );
}
