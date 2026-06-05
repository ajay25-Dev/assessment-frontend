import { Database, FileQuestion, Code2, BookOpen } from "lucide-react";
import Link from "next/link";
import { sectionOrder, type AssessmentSectionId } from "@/data/assessment-bank";
import { fetchAssessmentBank } from "@/lib/assessment-bank-api";

export const dynamic = "force-dynamic";

function iconForSection(section: AssessmentSectionId) {
  if (section === "DSA") return Code2;
  if (section === "SQL") return Database;
  if (section === "OOPs") return BookOpen;
  return FileQuestion;
}

export default async function QuestionBankPage() {
  const assessmentBank = await fetchAssessmentBank().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Question bank could not be loaded.";
    return { error: message };
  });

  if ("error" in assessmentBank) {
    return (
      <section className="rounded-[8px] border border-amber-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-800">Question Bank</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">Backend question bank is unavailable</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{assessmentBank.error}</p>
        <Link href="/admin/question-bank" className="mt-5 inline-flex rounded-[8px] bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">
          Retry
        </Link>
      </section>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">Question Bank</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-950">{assessmentBank.assessment.title}</h2>
        <p className="mt-3 max-w-3xl leading-7 text-slate-600">{assessmentBank.assessment.description}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {sectionOrder.map((section) => {
            const Icon = iconForSection(section);
            const meta = assessmentBank.assessment.sections.find((item) => item.name === section);
            const count = assessmentBank.questions.filter((question) => question.section === section).length;
            return (
              <article key={section} className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 font-semibold text-slate-950">
                  <Icon size={18} />
                  {section}
                </div>
                <dl className="mt-4 grid gap-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Questions</dt>
                    <dd className="font-semibold text-slate-950">{count}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Duration</dt>
                    <dd className="font-semibold text-slate-950">{meta?.duration_minutes} min</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Weight</dt>
                    <dd className="font-semibold text-slate-950">{assessmentBank.assessment.scoring_weights[section]}%</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="font-semibold text-slate-950">Import Preview</h3>
          <p className="mt-1 text-sm text-slate-600">
            Source: <span className="font-mono">assessment-data/joraiq-question-bank.json</span>
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Section</th>
                <th className="px-4 py-3 font-medium">Question</th>
                <th className="px-4 py-3 font-medium">Engine</th>
                <th className="px-4 py-3 font-medium">Difficulty</th>
                <th className="px-4 py-3 font-medium">Execution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assessmentBank.questions.map((question) => (
                <tr key={question.id}>
                  <td className="px-4 py-3 font-semibold text-emerald-800">{question.section}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-950">{question.title}</div>
                    <div className="mt-1 font-mono text-xs text-slate-500">{question.id}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{question.engine}</td>
                  <td className="px-4 py-3 text-slate-600">{question.difficulty || question.topic || "-"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {question.engine === "code"
                      ? `CodeMirror + Judge0 (${question.allowed_languages?.length || 0} languages)`
                      : question.engine === "sql"
                        ? "CodeMirror SQL + PostgreSQL sandbox"
                        : "Structured options"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
