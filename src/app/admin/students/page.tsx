import { revalidatePath } from "next/cache";
import { cleanString, requireAdmin } from "@/lib/admin/supabase-admin";

export const dynamic = "force-dynamic";

async function updateStudentBatch(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const studentId = cleanString(formData.get("student_id"));
  if (!studentId) return;
  const batchId = cleanString(formData.get("batch_id"));

  await supabase
    .from("batch_students")
    .delete()
    .eq("student_id", studentId);

  if (batchId) {
    await supabase.from("batch_students").insert({
      batch_id: batchId,
      student_id: studentId,
    });
  }

  revalidatePath("/admin/students");
}

export default async function StudentsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: studentRows }, { data: batchRows }, { data: collegeRows }, { data: assignmentRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,email,full_name,role,created_at")
      .eq("role", "student")
      .order("created_at", { ascending: false }),
    supabase.from("batches").select("id,name,college_id,status").order("name"),
    supabase.from("colleges").select("id,name").order("name"),
    supabase.from("batch_students").select("batch_id,student_id,created_at").order("created_at", { ascending: false }),
  ]);

  const students = (studentRows || []) as unknown as Array<Record<string, string | null>>;
  const batches = (batchRows || []) as unknown as Array<Record<string, string | null>>;
  const colleges = (collegeRows || []) as unknown as Array<Record<string, string | null>>;
  const assignments = (assignmentRows || []) as unknown as Array<Record<string, string | null>>;
  const collegeById = new Map(colleges.map((college) => [college.id, college.name]));
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));
  const assignmentByStudentId = new Map<string | null, string | null>();
  assignments.forEach((assignment) => {
    if (!assignmentByStudentId.has(assignment.student_id)) {
      assignmentByStudentId.set(assignment.student_id, assignment.batch_id);
    }
  });

  return (
    <div className="grid gap-6">
      <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-950">Registered Students</h2>
        <p className="mt-2 text-sm text-slate-600">
          Students are read from <span className="font-mono">profiles</span>. Assign batches here; each batch is connected to a college.
        </p>
      </section>

      <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Batch</th>
                <th className="px-4 py-3 font-medium">College</th>
                <th className="px-4 py-3 font-medium">Assign Batch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((student) => {
                const assignedBatchId = assignmentByStudentId.get(student.id) || "";
                const assignedBatch = batchById.get(assignedBatchId);
                const collegeName = assignedBatch ? collegeById.get(assignedBatch.college_id) : null;

                return (
                  <tr key={String(student.id)}>
                    <td className="px-4 py-3 font-medium text-slate-950">{student.full_name || "Unnamed"}</td>
                    <td className="px-4 py-3 text-slate-600">{student.email}</td>
                    <td className="px-4 py-3 text-slate-600">{assignedBatch?.name || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{collegeName || "-"}</td>
                    <td className="px-4 py-3">
                      <form action={updateStudentBatch} className="flex gap-2">
                        <input type="hidden" name="student_id" value={String(student.id)} />
                        <select
                          name="batch_id"
                          defaultValue={String(assignedBatchId)}
                          className="min-w-56 rounded-[8px] border border-slate-300 px-3 py-2 text-sm"
                        >
                          <option value="">No batch</option>
                          {batches.map((batch) => (
                            <option key={String(batch.id)} value={String(batch.id)}>
                              {batch.name}
                              {batch.college_id ? ` - ${collegeById.get(batch.college_id) || "College"}` : ""}
                            </option>
                          ))}
                        </select>
                        <button className="rounded-[8px] bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
                          Save
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {students.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>No registered students yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
