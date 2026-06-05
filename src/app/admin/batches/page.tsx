import { revalidatePath } from "next/cache";
import { cleanString, requireAdmin } from "@/lib/admin/supabase-admin";

export const dynamic = "force-dynamic";

async function createBatch(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const name = cleanString(formData.get("name"));
  if (!name) return;

  await supabase.from("batches").insert({
    name,
    college_id: cleanString(formData.get("college_id")),
    starts_at: cleanString(formData.get("starts_at")),
    ends_at: cleanString(formData.get("ends_at")),
    status: cleanString(formData.get("status")) || "active",
  });

  revalidatePath("/admin/batches");
}

export default async function BatchesPage() {
  const { supabase } = await requireAdmin();
  const [{ data: batchRows }, { data: collegeRows }] = await Promise.all([
    supabase.from("batches").select("id,name,status,starts_at,ends_at,college_id,created_at").order("created_at", { ascending: false }),
    supabase.from("colleges").select("id,name").order("name"),
  ]);
  const batches = (batchRows || []) as unknown as Array<Record<string, string | null>>;
  const colleges = (collegeRows || []) as unknown as Array<Record<string, string | null>>;
  const collegeById = new Map(colleges.map((college) => [college.id, college.name]));

  return (
    <div className="grid gap-6">
      <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-950">Batches</h2>
        <p className="mt-2 text-sm text-slate-600">Create batches and connect them to colleges.</p>
        <form action={createBatch} className="mt-5 grid gap-3 md:grid-cols-6">
          <input name="name" required placeholder="Batch name" className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
          <select name="college_id" className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm md:col-span-2">
            <option value="">Select college</option>
            {colleges.map((college) => (
              <option key={String(college.id)} value={String(college.id)}>{college.name}</option>
            ))}
          </select>
          <select name="status" className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm">
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
          <button className="rounded-[8px] bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
            Add Batch
          </button>
          <input name="starts_at" type="date" className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm" />
          <input name="ends_at" type="date" className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm" />
        </form>
      </section>

      <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Batch</th>
                <th className="px-4 py-3 font-medium">College</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Dates</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.map((batch) => (
                <tr key={String(batch.id)}>
                  <td className="px-4 py-3 font-medium text-slate-950">{batch.name}</td>
                  <td className="px-4 py-3 text-slate-600">{collegeById.get(batch.college_id) || "-"}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{batch.status}</td>
                  <td className="px-4 py-3 text-slate-600">{batch.starts_at || "-"} to {batch.ends_at || "-"}</td>
                </tr>
              ))}
              {batches.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={4}>No batches yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
