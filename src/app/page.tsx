import { redirect } from "next/navigation";
import Dashboard from "./dashboard";
import { currentIdentity } from "@/lib/auth";

export const dynamic = "force-dynamic";
export default async function Home() {
  const identity = await currentIdentity();
  if (!identity) redirect("/login");
  return <Dashboard organizationName={identity.organizationName} email={identity.email} />;
}
