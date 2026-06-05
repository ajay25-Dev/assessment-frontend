import Link from "next/link";
import { revalidatePath } from "next/cache";
import { cleanNumber, cleanString, requireAdmin } from "@/lib/admin/supabase-admin";

export const dynamic = "force-dynamic";

const subjectTypeLabels: Record<string, string> = {
  coding_with_data: "Coding with data",
  coding_without_data: "Coding without data",
  text: "Text",
  subjective: "Subjective",
};

function subjectLabel(subject: Record<string, string | null>) {
  const typeLabel = subject.subject_type ? subjectTypeLabels[subject.subject_type] : null;
  const durationLabel = subject.duration_minutes ? `${subject.duration_minutes} min` : null;
  return [subject.name, typeLabel, durationLabel].filter(Boolean).join(" - ");
}

async function createAssessment(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const title = cleanString(formData.get("title"));
  if (!title) return;
  const batchId = cleanString(formData.get("batch_id"));
  const subjectIds = formData
    .getAll("subject_ids")
    .map((value) => cleanString(value))
    .filter(Boolean);

  const { data } = await supabase
    .from("assessments")
    .insert({
      title,
      description: cleanString(formData.get("description")),
      duration_minutes: cleanNumber(formData.get("duration_minutes")) || 180,
      status: cleanString(formData.get("status")) || "draft",
    })
    .select("id")
    .single();

  const assessmentId = (data as { id?: string } | null)?.id;
  if (assessmentId) {
    const sections = [
      { name: "DSA Coding", duration_minutes: 90, focus_area: "Hard-level DSA", difficulty: "Hard", sort_order: 1 },
      { name: "SQL", duration_minutes: 30, focus_area: "Scenario-based SQL queries", difficulty: "Very hard", sort_order: 2 },
      { name: "OOPs", duration_minutes: 30, focus_area: "Scenario-based OOPs questions", difficulty: "Medium to hard", sort_order: 3 },
      { name: "Core CS MCQs", duration_minutes: 30, focus_area: "CN, OS, Cloud, Security, Architecture, MS Office", difficulty: "Scenario-based", sort_order: 4 },
    ];

    await supabase
      .from("assessment_sections")
      .insert(sections.map((section) => ({ ...section, assessment_id: assessmentId })));

    if (batchId) {
      await supabase.from("assessment_batches").insert({
        assessment_id: assessmentId,
        batch_id: batchId,
      });
    }

    if (subjectIds.length > 0) {
      await supabase.from("assessment_subjects").insert(
        subjectIds.map((subjectId) => ({
          assessment_id: assessmentId,
          subject_id: subjectId,
        })),
      );
    }
  }

  revalidatePath("/admin/assessments");
}

export default async function AssessmentsPage() {
  const { supabase } = await requireAdmin();
  const [{ data }, { data: batchRows }, { data: collegeRows }, { data: assessmentBatchRows }, { data: subjectRows }, { data: assessmentSubjectRows }] = await Promise.all([
    supabase
      .from("assessments")
      .select("id,title,description,duration_minutes,status,created_at")
      .order("created_at", { ascending: false }),
    supabase.from("batches").select("id,name,college_id,status").order("name"),
    supabase.from("colleges").select("id,name").order("name"),
    supabase.from("assessment_batches").select("assessment_id,batch_id,created_at").order("created_at"),
    supabase.from("subjects").select("id,name,code,subject_type,duration_minutes").order("name"),
    supabase.from("assessment_subjects").select("assessment_id,subject_id,created_at").order("created_at"),
  ]);
  const assessments = (data || []) as unknown as Array<Record<string, string | number | null>>;
  const batches = (batchRows || []) as unknown as Array<Record<string, string | null>>;
  const colleges = (collegeRows || []) as unknown as Array<Record<string, string | null>>;
  const assessmentBatches = (assessmentBatchRows || []) as unknown as Array<Record<string, string | null>>;
  const subjects = (subjectRows || []) as unknown as Array<Record<string, string | null>>;
  const assessmentSubjects = (assessmentSubjectRows || []) as unknown as Array<Record<string, string | null>>;
  const collegeById = new Map(colleges.map((college) => [college.id, college.name]));
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const batchIdsByAssessmentId = assessmentBatches.reduce<Map<string | null, string[]>>((map, row) => {
    const existing = map.get(row.assessment_id) || [];
    if (row.batch_id) existing.push(row.batch_id);
    map.set(row.assessment_id, existing);
    return map;
  }, new Map());
  const subjectIdsByAssessmentId = assessmentSubjects.reduce<Map<string | null, string[]>>((map, row) => {
    const existing = map.get(row.assessment_id) || [];
    if (row.subject_id) existing.push(row.subject_id);
    map.set(row.assessment_id, existing);
    return map;
  }, new Map());

  return (
    <div className="grid gap-6">
      <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-950">Assessments</h2>
        <p className="mt-2 text-sm text-slate-600">Create assessments, assign them to batches, and configure question setup per section.</p>
        <form action={createAssessment} className="mt-5 grid gap-3 md:grid-cols-6">
          <input name="title" required placeholder="Assessment title" className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
          <input name="duration_minutes" type="number" defaultValue="180" className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm" />
          <select name="status" className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <select name="batch_id" className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm md:col-span-2">
            <option value="">Assign batch</option>
            {batches.map((batch) => (
              <option key={String(batch.id)} value={String(batch.id)}>
                {batch.name}
                {batch.college_id ? ` - ${collegeById.get(batch.college_id) || "College"}` : ""}
              </option>
            ))}
          </select>
          <select
            name="subject_ids"
            multiple
            required
            className="min-h-28 rounded-[8px] border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          >
            {subjects.map((subject) => (
              <option key={String(subject.id)} value={String(subject.id)}>
                {subjectLabel(subject)}
              </option>
            ))}
          </select>
          <p className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 md:col-span-2">
            Hold Ctrl and click to select multiple subjects.
          </p>
          <input name="description" placeholder="Short description" className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm md:col-span-5" />
          <button className="rounded-[8px] bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
            Add Assessment
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Assessment</th>
                <th className="px-4 py-3 font-medium">Batch</th>
                <th className="px-4 py-3 font-medium">Subjects</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Questions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assessments.map((assessment) => {
                const assignedBatchLabels = (batchIdsByAssessmentId.get(String(assessment.id)) || [])
                  .map((batchId) => {
                    const batch = batchById.get(batchId);
                    if (!batch) return null;
                    const collegeName = batch.college_id ? collegeById.get(batch.college_id) : null;
                    return collegeName ? `${batch.name} (${collegeName})` : batch.name;
                  })
                  .filter(Boolean);
                const assignedSubjectLabels = (subjectIdsByAssessmentId.get(String(assessment.id)) || [])
                  .map((subjectId) => {
                    const subject = subjectById.get(subjectId);
                    return subject ? subjectLabel(subject) : null;
                  })
                  .filter(Boolean);

                return (
                  <tr key={String(assessment.id)}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-950">{assessment.title}</div>
                      <div className="mt-1 text-slate-500">{assessment.description || "-"}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {assignedBatchLabels.length > 0 ? assignedBatchLabels.join(", ") : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {assignedSubjectLabels.length > 0 ? (
                          assignedSubjectLabels.map((subject) => (
                            <span key={String(subject)} className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
                              {subject}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{assessment.duration_minutes} min</td>
                    <td className="px-4 py-3 capitalize text-slate-600">{assessment.status}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/assessments/${assessment.id}/questions`}
                        className="rounded-[8px] border border-slate-300 px-3 py-2 font-medium text-slate-800 hover:bg-slate-50"
                      >
                        Setup Questions
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {assessments.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>No assessments yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
