import { AdminPanel } from "@/features/admin/AdminPanel";

export const metadata = { title: "loop · admin" };

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <AdminPanel />
    </main>
  );
}
