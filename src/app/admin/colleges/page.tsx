import { revalidatePath } from "next/cache";
import { cleanString, requireAdmin } from "@/lib/admin/supabase-admin";

export const dynamic = "force-dynamic";

async function createCollege(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const name = cleanString(formData.get("name"));
  if (!name) return;

  await supabase.from("colleges").insert({
    name,
    code: cleanString(formData.get("code")),
    city: cleanString(formData.get("city")),
    state: cleanString(formData.get("state")),
    contact_email: cleanString(formData.get("contact_email")),
  });

  revalidatePath("/admin/colleges");
}

export default async function CollegesPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("colleges")
    .select("id,name,code,city,state,contact_email,created_at")
    .order("created_at", { ascending: false });
  const colleges = (data || []) as unknown as Array<Record<string, string | null>>;

  return (
    <div className="grid gap-6">
      <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-950">Colleges</h2>
        <p className="mt-2 text-sm text-slate-600">Create colleges and use them while assigning students and batches.</p>
        <form action={createCollege} className="mt-5 grid gap-3 md:grid-cols-5">
          <input name="name" required placeholder="College name" className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
          <input name="code" placeholder="Code" className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm" />
          <input name="city" placeholder="City" className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm" />
          <input name="state" placeholder="State" className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm" />
          <input name="contact_email" placeholder="Contact email" className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm md:col-span-4" />
          <button className="rounded-[8px] bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
            Add College
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">College</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {colleges.map((college) => (
                <tr key={String(college.id)}>
                  <td className="px-4 py-3 font-medium text-slate-950">{college.name}</td>
                  <td className="px-4 py-3 text-slate-600">{college.code || "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{[college.city, college.state].filter(Boolean).join(", ") || "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{college.contact_email || "-"}</td>
                </tr>
              ))}
              {colleges.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={4}>No colleges yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
