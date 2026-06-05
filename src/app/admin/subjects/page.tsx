import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cleanNumber, cleanString, requireAdmin } from "@/lib/admin/supabase-admin";

export const dynamic = "force-dynamic";

const subjectTypes = [
  { value: "coding_with_data", label: "Coding with data" },
  { value: "coding_without_data", label: "Coding without data" },
  { value: "text", label: "Text" },
  { value: "subjective", label: "Subjective" },
];

function subjectTypeLabel(value: string | null | undefined) {
  return subjectTypes.find((type) => type.value === value)?.label || "Subjective";
}

async function createSubject(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const name = cleanString(formData.get("name"));
  if (!name) return;

  const { error } = await supabase.from("subjects").insert({
    name,
    code: cleanString(formData.get("code")),
    subject_type: cleanString(formData.get("subject_type")) || "subjective",
    duration_minutes: cleanNumber(formData.get("duration_minutes")),
    description: cleanString(formData.get("description")),
  });

  if (error) {
    redirect(`/admin/subjects?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/subjects");
  revalidatePath("/admin/assessments");
}

export default async function SubjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("subjects")
    .select("id,name,code,subject_type,duration_minutes,description,created_at")
    .order("created_at", { ascending: false });

  const subjects = (data || []) as unknown as Array<Record<string, string | null>>;

  return (
    <div className="grid gap-6">
      <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-950">Subjects</h2>
        <p className="mt-2 text-sm text-slate-600">
          Create reusable subjects and define how each subject will be answered.
        </p>
        {(resolvedSearchParams.error || error?.message) ? (
          <div className="mt-4 rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {resolvedSearchParams.error || error?.message}
          </div>
        ) : null}
        <form action={createSubject} className="mt-5 grid gap-3 md:grid-cols-6">
          <input
            name="name"
            required
            placeholder="Subject name"
            className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          />
          <input
            name="code"
            placeholder="Code, e.g. DSA"
            className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            name="subject_type"
            defaultValue="subjective"
            className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm"
          >
            {subjectTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <input
            name="duration_minutes"
            type="number"
            min="1"
            placeholder="Duration min"
            className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm"
          />
          <button className="rounded-[8px] bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
            Add Subject
          </button>
          <input
            name="description"
            placeholder="Short description"
            className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm md:col-span-5"
          />
        </form>
      </section>

      <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subjects.map((subject) => (
                <tr key={String(subject.id)}>
                  <td className="px-4 py-3 font-medium text-slate-950">{subject.name}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{subject.code || "-"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
                      {subjectTypeLabel(subject.subject_type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {subject.duration_minutes ? `${subject.duration_minutes} min` : "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{subject.description || "-"}</td>
                </tr>
              ))}
              {subjects.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
                    No subjects yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
