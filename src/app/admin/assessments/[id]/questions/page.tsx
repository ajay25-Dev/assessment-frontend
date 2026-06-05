import Link from "next/link";
import { revalidatePath } from "next/cache";
import { QuestionSetupForm } from "@/components/admin/question-setup-form";
import { cleanNumber, cleanString, requireAdmin } from "@/lib/admin/supabase-admin";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }> | { id: string };
};

function parseJsonArray(value: FormDataEntryValue | null) {
  const text = cleanString(value);
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function createQuestion(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const assessmentId = cleanString(formData.get("assessment_id"));
  const title = cleanString(formData.get("title"));
  const prompt = cleanString(formData.get("prompt"));
  if (!assessmentId || !title || !prompt) return;
  const questionType = cleanString(formData.get("question_type")) || "subjective";
  const correctOptions = new Set(formData.getAll("correct_options").map((value) => String(value)));
  const mcqOptions = ["A", "B", "C", "D"]
    .map((label) => ({
      label,
      text: cleanString(formData.get(`option_${label}`)),
      is_correct: correctOptions.has(label),
    }))
    .filter((option) => option.text);
  const expectedAnswer = cleanString(formData.get("expected_answer"));

  await supabase.from("assessment_questions").insert({
    assessment_id: assessmentId,
    section_id: cleanString(formData.get("section_id")),
    subject_id: cleanString(formData.get("subject_id")),
    question_type: questionType,
    question_format: questionType,
    title,
    prompt,
    prompt_rich_text: cleanString(formData.get("prompt_rich_text")),
    difficulty: cleanString(formData.get("difficulty")) || "medium",
    marks: cleanNumber(formData.get("marks")),
    open_test_cases: parseJsonArray(formData.get("open_test_cases")),
    hidden_test_cases: parseJsonArray(formData.get("hidden_test_cases")),
    time_limit_ms: cleanNumber(formData.get("time_limit_ms")),
    memory_limit_mb: cleanNumber(formData.get("memory_limit_mb")),
    compilation_attempt_limit: cleanNumber(formData.get("compilation_attempt_limit")),
    expected_answer: expectedAnswer,
    correct_answer: expectedAnswer || Array.from(correctOptions).join(","),
    allow_multiple_answers: cleanString(formData.get("allow_multiple_answers")) === "true",
    options: mcqOptions,
    sort_order: cleanNumber(formData.get("sort_order")) || 0,
  });

  revalidatePath(`/admin/assessments/${assessmentId}/questions`);
}

export default async function AssessmentQuestionsPage({ params }: PageProps) {
  const resolvedParams = await params;
  const assessmentId = resolvedParams.id;
  const { supabase } = await requireAdmin();

  const [{ data: assessment }, { data: sectionRows }, { data: questionRows }, { data: subjectRows }] = await Promise.all([
    supabase.from("assessments").select("id,title,status,duration_minutes").eq("id", assessmentId).maybeSingle(),
    supabase.from("assessment_sections").select("id,name,duration_minutes,sort_order").eq("assessment_id", assessmentId).order("sort_order"),
    supabase
      .from("assessment_questions")
      .select("id,title,question_type,question_format,difficulty,marks,section_id,subject_id,time_limit_ms,memory_limit_mb,compilation_attempt_limit,sort_order")
      .eq("assessment_id", assessmentId)
      .order("sort_order"),
    supabase.from("subjects").select("id,name,subject_type,duration_minutes").order("name"),
  ]);

  const assessmentRow = assessment as { title?: string | null } | null;
  const sections = (sectionRows || []) as unknown as Array<Record<string, string | number | null>>;
  const questions = (questionRows || []) as unknown as Array<Record<string, string | number | null>>;
  const allSubjects = (subjectRows || []) as unknown as Array<Record<string, string | number | null>>;
  const subjects = allSubjects;
  const sectionById = new Map(sections.map((section) => [section.id, section.name]));
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject.name]));

  return (
    <div className="grid gap-6">
      <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
        <Link href="/admin/assessments" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
          Back to assessments
        </Link>
        <h2 className="mt-3 text-2xl font-semibold text-slate-950">
          Question Setup: {assessmentRow?.title || "Assessment"}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Configure rich prompts, MCQs, expected answers, coding limits, test cases, and scoring.
        </p>
      </section>

      <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-slate-950">Add Question</h3>
        <QuestionSetupForm
          assessmentId={assessmentId}
          subjects={subjects.map((subject) => ({ id: String(subject.id), name: String(subject.name) }))}
          action={createQuestion}
        />
      </section>

      <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Question</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Difficulty</th>
                <th className="px-4 py-3 font-medium">Marks</th>
                <th className="px-4 py-3 font-medium">Limits</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {questions.map((question) => (
                <tr key={String(question.id)}>
                  <td className="px-4 py-3 font-medium text-slate-950">{question.title}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {subjectById.get(question.subject_id) || sectionById.get(question.section_id) || "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{question.question_format || question.question_type}</td>
                  <td className="px-4 py-3 text-slate-600">{question.difficulty}</td>
                  <td className="px-4 py-3 text-slate-600">{question.marks || "-"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {question.time_limit_ms || "-"} ms, {question.memory_limit_mb || "-"} MB, {question.compilation_attempt_limit || "-"} compiles
                  </td>
                </tr>
              ))}
              {questions.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>No questions yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
