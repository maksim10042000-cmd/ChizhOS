import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { getSession } from "@/lib/session";
import { getSettings } from "@/lib/data/repo";
import { firstAllowedHref } from "@/lib/current";

// Страница входа. Сессия читается из БД, поэтому кешировать нечего.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(firstAllowedHref(session));

  const { orgName } = await getSettings();
  return <LoginForm orgName={orgName} />;
}
