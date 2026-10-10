import { AdminPanel } from "@/features/admin/AdminPanel";

export const metadata = { title: "loop · admin" };

export default function AdminPage() {
  return (
    <main data-theme="paper" className="min-h-screen bg-bg text-ink">
      <AdminPanel />
    </main>
  );
}
