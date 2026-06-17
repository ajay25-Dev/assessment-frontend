import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  ChevronDown,
  Code2,
  Database,
  FileText,
  Gauge,
  GraduationCap,
  Layers3,
  ScrollText,
  ShieldAlert,
  Sparkles,
  Target,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import {
  asRecord,
  asStringArray,
  clampScore,
  CodeRunRow,
  formatDateTime,
  formatScore,
  generateStudentReportPdf,
  asSectionEvaluationArray,
  mapTechnicalLabelToTeacherLabel,
  McqAnswerRow,
  normalizeAiEvaluation,
  normalizeBucket,
  readinessClasses,
  ReportRow,
  riskClasses,
  safeText,
  ProfileRow,
  QuestionAttemptRow,
  QuestionEvaluationRow,
  SqlRunRow,
  extractSkillScores,
  extractStrengths,
  extractTeacherActions,
  extractWeaknesses,
} from "@/lib/admin/student-report";

type StudentAttemptReportProps = {
  report: ReportRow;
  profile: ProfileRow | null;
  assignments: { batch_id: string | null; student_id: string | null; created_at: string | null }[];
  batches: { id: string; name: string | null; college_id: string | null }[];
  colleges: { id: string; name: string | null }[];
  questionAttempts: QuestionAttemptRow[];
  evaluations: QuestionEvaluationRow[];
  codeRuns: CodeRunRow[];
  sqlRuns: SqlRunRow[];
  mcqAnswers: McqAnswerRow[];
  studentId: string;
  attemptId: string;
  printMode?: boolean;
};

function sectionIcon(section: string) {
  if (section === "DSA") return Code2;
  if (section === "SQL") return Database;
  if (section === "OOPs") return Wrench;
  return BookOpen;
}

function valueList(value: unknown, emptyLabel = "Not available") {
  const items = asStringArray(value);
  if (items.length === 0) return <p className="text-sm text-slate-500">{emptyLabel}</p>;

  return (
    <ul className="grid gap-2 text-sm text-slate-700">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 leading-6">
          {item}
        </li>
      ))}
    </ul>
  );
}

function formatStructuredValue(value: unknown) {
  if (value === null || value === undefined) return "Not available";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value) || typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return safeText(value);
    }
  }
  return safeText(value);
}

function valueTable(
  entries: Array<{ label: string; value: unknown }>,
  compact = false,
  showEmpty = false,
) {
  const filtered = showEmpty
    ? entries
    : entries.filter(
        (entry) =>
          entry.value !== null &&
          entry.value !== undefined &&
          `${entry.value}`.trim().length > 0,
      );

  if (!filtered.length) {
    return <p className="text-sm text-slate-500">Not available</p>;
  }

  return (
    <div className={`overflow-hidden rounded-[16px] border border-slate-200 bg-white ${compact ? "" : "shadow-sm"}`}>
      <table className="w-full text-left text-sm">
        <tbody className="divide-y divide-slate-100">
          {filtered.map((entry) => (
            <tr key={entry.label}>
              <th className="w-[38%] bg-slate-50 px-4 py-3 align-top text-sm font-medium text-slate-600">
                {mapTechnicalLabelToTeacherLabel(entry.label)}
              </th>
              <td className="px-4 py-3 align-top text-sm leading-6 text-slate-800">
                {Array.isArray(entry.value) ? (
                  (entry.value as unknown[]).length === 0 ? (
                    <span className="text-slate-500">Not available</span>
                  ) : (entry.value as unknown[]).every((item) => item === null || item === undefined || ["string", "number", "boolean"].includes(typeof item)) ? (
                    <ul className="grid gap-1">
                      {(entry.value as unknown[]).map((item, index) => (
                        <li key={`${entry.label}-${index}`}>{safeText(item)}</li>
                      ))}
                    </ul>
                  ) : (
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-[12px] bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                      {formatStructuredValue(entry.value)}
                    </pre>
                  )
                ) : typeof entry.value === "object" && entry.value !== null ? (
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-[12px] bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                    {formatStructuredValue(entry.value)}
                  </pre>
                ) : (
                  safeText(entry.value)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function interpretScore(score: number) {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Needs light revision";
  if (score >= 40) return "Needs practice";
  return "Needs immediate support";
}

function skillIcon(label: string) {
  if (label.includes("DSA")) return Code2;
  if (label.includes("SQL")) return Database;
  if (label.includes("OOP")) return Wrench;
  if (label.includes("MCQ")) return BookOpen;
  if (label.includes("Hidden")) return ShieldAlert;
  if (label.includes("Overall")) return Gauge;
  if (label.includes("Problem Solving")) return GraduationCap;
  if (label.includes("Readiness")) return GraduationCap;
  if (label.includes("Code")) return FileText;
  if (label.includes("Complexity")) return Layers3;
  return Target;
}

function yesNoText(value: unknown) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Not available";
}

function countPair(passed: unknown, total: unknown) {
  const passedText = passed === null || passed === undefined ? "Not available" : String(passed);
  const totalText = total === null || total === undefined ? "Not available" : String(total);
  if (passedText === "Not available" && totalText === "Not available") return "Not available";
  return `${passedText} / ${totalText}`;
}

function sectionParameterRows(params: {
  section: string;
  evaluationOutput: Record<string, unknown> | null;
  codeRun?: CodeRunRow | null;
  sqlRun?: SqlRunRow | null;
  mcq?: McqAnswerRow | null;
}) {
  const { section, evaluationOutput, codeRun, sqlRun, mcq } = params;
  const output = evaluationOutput ?? {};

  if (section === "DSA") {
    return [
      {
        label: "Score Basis",
        value: "Score is calculated from visible test correctness, expected code checklist coverage, code-derived complexity ranks versus the question-bank targets, and edge-case performance.",
      },
      { label: "Correctness Score", value: output.correctness_score },
      { label: "Open Test Case Score", value: output.open_test_case_score },
      { label: "Hidden Test Case Score", value: output.hidden_test_case_score },
      // { label: "Expected Code Checklist Score", value: output.expected_code_score },
      // { label: "Matched Expected Code", value: output.matched_expected_code },
      // { label: "Missing Expected Code", value: output.missing_expected_code },
      { label: "Approach Match Percentage", value: output.approach_match_percentage },
      { label: "Expected Approach Used", value: output.expected_approach_used },
      { label: "Expected Approach Tags", value: output.expected_approach_tags },
      { label: "AI Returned Approach Tags", value: output.ai_returned_approach_tags },
      { label: "Expected Time Complexity", value: output.expected_time_complexity_label || output.expected_time_complexity },
      { label: "Calculated Time Complexity", value: output.student_time_complexity_label },
      { label: "Expected Time Complexity Rank", value: output.expected_time_complexity_rank },
      { label: "Expected Time Complexity Score Rank", value: output.expected_time_complexity_score_rank },
      { label: "Student Time Complexity Rank", value: output.student_time_complexity_rank },
      { label: "Student Time Complexity Score Rank", value: output.student_time_complexity_score_rank },
      { label: "Time Complexity Rank Gap", value: output.time_complexity_rank_gap },
      { label: "Time Complexity Score Rank Gap", value: output.time_complexity_score_rank_gap },
      { label: "Time Complexity Score", value: output.time_complexity_score },
      { label: "Expected Space Complexity", value: output.expected_space_complexity_label || output.expected_space_complexity },
      { label: "Calculated Space Complexity", value: output.student_space_complexity_label },
      { label: "Expected Space Complexity Rank", value: output.expected_space_complexity_rank },
      { label: "Expected Space Complexity Score Rank", value: output.expected_space_complexity_score_rank },
      { label: "Student Space Complexity Rank", value: output.student_space_complexity_rank },
      { label: "Student Space Complexity Score Rank", value: output.student_space_complexity_score_rank },
      { label: "Space Complexity Rank Gap", value: output.space_complexity_rank_gap },
      { label: "Space Complexity Score Rank Gap", value: output.space_complexity_score_rank_gap },
      { label: "Space Complexity Score", value: output.space_complexity_score },
      { label: "Edge Case Score", value: output.edge_case_score },
      { label: "Edge Cases Passed", value: output.edge_cases_passed },
      { label: "Open Tests Passed", value: countPair(codeRun?.open_tests_passed, codeRun?.open_tests_total) },
      { label: "Hidden Tests Passed", value: countPair(codeRun?.hidden_tests_passed, codeRun?.hidden_tests_total) },
      { label: "Overall Question Score", value: output.overall_question_score },
      // { label: "Failed Case Analysis", value: output.failed_case_analysis },
      { label: "Missed Edge Cases", value: output.missed_edge_cases },
    ];
  }

  if (section === "SQL") {
    return [
      {
        label: "Score Basis",
        value:
          "Result correctness against visible expected rows, business rules, SQL concepts, query efficiency, formatting, aliasing, structure, simplicity, and NULL or duplicate handling.",
      },
      { label: "Result Correctness Score", value: output.result_correctness_score },
      { label: "Business Logic Score", value: output.business_logic_score },
      { label: "SQL Concept Score", value: output.sql_concept_score },
      { label: "Query Efficiency Score", value: output.query_efficiency_score },
      { label: "Formatting Score", value: output.formatting_score },
      { label: "Alias Score", value: output.alias_score },
      { label: "Structure Score", value: output.structure_score },
      { label: "Simplicity Score", value: output.simplicity_score },
      { label: "Readability Score", value: output.readability_score },
      { label: "NULL / Duplicate Handling Score", value: output.null_duplicate_handling_score },
      { label: "Overall Question Score", value: output.overall_question_score },
      { label: "Placement Readiness Label", value: output.placement_readiness_label },
      // { label: "Execution Status", value: safeText((sqlRun as { status?: unknown } | null)?.status ?? sqlRun?.run_type, "Not available") },
      // { label: "Expected Columns", value: output.expected_columns },
      // { label: "Visible Expected Rows", value: output.visible_expected_rows },
      // { label: "Result Match Rules", value: output.result_match },
      // { label: "Required Business Rules", value: output.required_business_rules },
      // { label: "Expected SQL Concepts", value: output.expected_sql_concepts },
      { label: "Expected SQL Concept Tags", value: output.expected_sql_concept_tags },
      // { label: "Edge Cases", value: output.edge_cases },
      // { label: "NULL Rules", value: output.null_rules },
      // { label: "Duplicate Rules", value: output.duplicate_rules },
      { label: "Hardcoding Risk", value: output.hardcoding_risk },
      { label: "Query Quality Label", value: output.query_quality_label },
      // { label: "AI Returned Concept Tags", value: output.ai_returned_concept_tags },
      // { label: "Expected Concepts Used", value: output.expected_concepts_used },
      { label: "Missing Concepts", value: output.missing_concepts },
      { label: "Detected Mistakes", value: output.detected_mistakes },
      { label: "Missing Business Rules", value: output.missing_business_rules },
      { label: "Key Strengths", value: output.key_strengths },
      { label: "Key Weaknesses", value: output.key_weaknesses },
      { label: "Improvement Recommendation", value: output.improvement_recommendation },
      // { label: "Runtime Observation", value: output.runtime_observation },
    ];
  }

  if (section === "OOPs") {
    return [
      {
        label: "Score Basis",
        value: "Class design, abstraction, encapsulation, polymorphism, extensibility, SOLID principles, error handling, and design maturity.",
      },
      { label: "Class Design Score", value: output.class_design_score },
      { label: "Abstraction Score", value: output.abstraction_score },
      { label: "Encapsulation Score", value: output.encapsulation_score },
      { label: "Polymorphism Score", value: output.polymorphism_score },
      { label: "Extensibility Score", value: output.extensibility_score },
      { label: "Separation of Concerns Score", value: output.separation_of_concerns_score },
      { label: "SOLID Principles Score", value: output.solid_principles_score },
      { label: "Error Handling Score", value: output.error_handling_score },
      { label: "Code Readability Score", value: output.code_readability_score },
      { label: "Design Pattern Awareness Score", value: output.design_pattern_awareness_score },
      { label: "Overall Question Score", value: output.overall_question_score },
      { label: "Design Maturity Label", value: output.design_maturity_label },
      { label: "Placement Readiness Label", value: output.placement_readiness_label },
      { label: "Identified Classes", value: output.identified_classes },
      { label: "Identified Interfaces / Abstractions", value: output.identified_interfaces_or_abstractions },
      { label: "Design Patterns Detected", value: output.design_patterns_detected },
      { label: "Missing Components", value: output.missing_components },
      { label: "Red Flags", value: output.red_flags },
      { label: "Key Strengths", value: output.key_strengths },
      { label: "Key Weaknesses", value: output.key_weaknesses },
      { label: "Improvement Recommendation", value: output.improvement_recommendation },
    ];
  }

  return [
    // { label: "Score Basis", value: "Exact answer match against the answer key. No AI evaluation is used for MCQ scoring." },
    { label: "Overall MCQ Score", value: output.overall_mcq_score },
    // { label: "Selected Options", value: asStringArray(mcq?.selected_options) },
    // { label: "Correctness", value: mcq?.is_correct === null || mcq?.is_correct === undefined ? "Not available" : mcq.is_correct ? "Correct" : "Incorrect" },
    // { label: "Scoring Method", value: "Exact match against the answer key" },
    // { label: "No AI Evaluation", value: "MCQ scoring is deterministic and does not use AI." },
    // { label: "Subject Scores", value: output.subject_scores },
    // { label: "Topic Scores", value: output.topic_scores },
    // { label: "Strong Topics", value: output.strong_topics },
    // { label: "Weak Topics", value: output.weak_topics },
    // { label: "Misconceptions Detected", value: output.misconceptions_detected },
    // { label: "Guessing Risk", value: output.guessing_risk },
    // { label: "Confidence Signal", value: output.confidence_signal },
    // { label: "Time Behavior Summary", value: output.time_behavior_summary },
    // { label: "Revision Recommendation", value: output.revision_recommendation },
    // { label: "Placement Readiness Label", value: output.placement_readiness_label },
  ];
}

function sectionEvidenceRows(params: {
  section: string;
  codeRun?: CodeRunRow | null;
  sqlRun?: SqlRunRow | null;
  question: QuestionAttemptRow;
}) {
  const { section, codeRun, sqlRun, question } = params;

  if (section === "DSA" || section === "OOPs") {
    return [
      { label: "Language", value: codeRun?.language || question.selected_language || "Not available" },
      { label: "Run Type", value: codeRun?.run_type || "Not available" },
      { label: "Status", value: codeRun?.status || "Not available" },
      { label: "Answer / Submission", value: codeRun?.source_code || question.answer_text || "No evidence provided" },
    ];
  }

  if (section === "SQL") {
    return [
      { label: "Run Type", value: sqlRun?.run_type || "Not available" },
      { label: "Rows Returned", value: sqlRun?.row_count ?? "Not available" },
      { label: "Execution Time (ms)", value: sqlRun?.execution_ms ?? "Not available" },
      { label: "Returned Columns", value: sqlRun?.columns || [] },
      { label: "Returned Rows", value: sqlRun?.rows || [] },
      { label: "Comparison Result", value: sqlRun?.comparison_result || "Not available" },
      { label: "Error", value: sqlRun?.error_text || "None" },
      { label: "Query", value: sqlRun?.query_text || question.answer_text || "No query submitted" },
    ];
  }

  return [
    { label: "Selected Options", value: asStringArray(question.selected_options) },
    { label: "Marked for Review", value: question.marked_for_review ? "Yes" : "No" },
    { label: "Last Autosaved", value: formatDateTime(question.last_autosaved_at) },
  ];
}

function submissionTextForQuestion(params: {
  section: string;
  question: QuestionAttemptRow;
  codeRun?: CodeRunRow | null;
  sqlRun?: SqlRunRow | null;
}) {
  const { section, question, codeRun, sqlRun } = params;

  if (section === "SQL") {
    return sqlRun?.query_text || question.answer_text || "No evidence provided";
  }

  if (section === "DSA" || section === "OOPs") {
    return codeRun?.source_code || question.answer_text || "No evidence provided";
  }

  return question.answer_text || "No evidence provided";
}

export function StudentAttemptReport({
  report,
  profile,
  assignments,
  batches,
  colleges,
  questionAttempts,
  evaluations,
  codeRuns,
  sqlRuns,
  mcqAnswers,
  studentId,
  attemptId,
  printMode = false,
}: StudentAttemptReportProps) {
  const reportJson = asRecord(report.report_json);
  const dashboardEvaluation = normalizeAiEvaluation(reportJson?.dashboard_evaluation);
  const dashboardOutput = asRecord(dashboardEvaluation?.output);
  const dashboardInput = asRecord(reportJson?.dashboard_input);
  const deterministicReadiness = asRecord(reportJson?.deterministic_readiness);
  const integrity = asRecord(reportJson?.integrity);
  const readinessBucket = normalizeBucket(report.readiness_bucket, report.readiness_label);
  const reportSectionEvaluations = asSectionEvaluationArray(reportJson?.section_evaluations);
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));
  const collegeById = new Map(colleges.map((college) => [college.id, college.name || ""]));
  const activeAssignment = assignments[0] || null;
  const activeBatch = activeAssignment?.batch_id ? batchById.get(activeAssignment.batch_id) : null;
  const batchName = activeBatch?.name || "Not available";
  const collegeName = activeBatch?.college_id ? collegeById.get(activeBatch.college_id) || "Not available" : "Not available";

  const latestReportDate = formatDateTime(report.created_at);
  const detailedStrengths = extractStrengths(report.detailed_strengths);
  const detailedWeaknesses = extractWeaknesses(report.detailed_weaknesses);
  const teacherActions = extractTeacherActions(report);
  const skillRows = extractSkillScores(report);
  const evaluationByQuestionId = new Map<string, QuestionEvaluationRow>();

  for (const item of evaluations) {
    evaluationByQuestionId.set(item.question_id, item);
  }

  for (const item of reportSectionEvaluations) {
    const output = asRecord(item.output);
    const questionId = safeText(output?.question_id || output?.question || output?.id, "");
    if (!questionId) continue;

    const fallbackOutput: Record<string, unknown> = {
      section: item.section,
      ...output,
    };
    const fallbackEvaluation: QuestionEvaluationRow = {
      question_id: questionId,
      section: item.section,
      deterministic_score: clampScore(
        fallbackOutput.overall_question_score ?? fallbackOutput.overall_mcq_score,
      ),
      ai_evaluation: {
        section: item.section,
        prompt_version: "report-json-fallback",
        model: "deterministic",
        output: fallbackOutput,
      },
      final_score: clampScore(
        fallbackOutput.overall_question_score ?? fallbackOutput.overall_mcq_score,
      ),
    };

    const existing = evaluationByQuestionId.get(questionId);
    const existingOutput = asRecord(normalizeAiEvaluation(existing?.ai_evaluation)?.output);
    if (!existing || !Object.keys(existingOutput || {}).length) {
      evaluationByQuestionId.set(questionId, fallbackEvaluation);
    }
  }
  const latestCodeRunByQuestionId = new Map<string, CodeRunRow>();
  const latestSqlRunByQuestionId = new Map<string, SqlRunRow>();
  const mcqByQuestionId = new Map(mcqAnswers.map((item) => [item.question_id, item]));

  for (const row of codeRuns) {
    if (!latestCodeRunByQuestionId.has(row.question_id)) {
      latestCodeRunByQuestionId.set(row.question_id, row);
    }
  }

  for (const row of sqlRuns) {
    if (!latestSqlRunByQuestionId.has(row.question_id)) {
      latestSqlRunByQuestionId.set(row.question_id, row);
    }
  }

  const groupedSections = ["DSA", "SQL", "OOPs", "MCQ"].map((section) => ({
    section,
    Icon: sectionIcon(section),
    questions: questionAttempts.filter((item) => item.section === section),
  })).filter((group) => group.questions.length > 0);

  const summaryMetrics = [
    { label: "Overall Score", value: formatScore(report.marks_score), helper: "How the student performed overall in this assessment." },
    { label: "Problem Solving Score", value: formatScore(report.problem_solving_score ?? report.capability_score), helper: "Deterministic score based on correctness, approach, complexity, edge cases, and code quality." },
    { label: "Readiness Score", value: formatScore(dashboardOutput?.readiness_score), helper: "Placement readiness summary based on marks, capability, solution quality, and risk signals." },
    { label: "Final Evaluation", value: readinessBucket, helper: "AI recommendation based on score, capability, and evidence." },
    { label: "Main Learning Gap", value: report.weakest_section || "Not available", helper: "Topic that needs the most focused revision." },
    { label: "Practice Priority", value: report.training_priority || "Not available", helper: "Suggested next topic or skill to practice." },
  ];

  const aiSummarySections = [
    {
      title: "Teacher Summary",
      tone: "blue" as const,
      content: (
        <div className="grid gap-3">
          <p>{report.student_summary || "Not available"}</p>
          <p>{report.faculty_insight || "Not available"}</p>
          <p>{report.company_recommendation || "Not available"}</p>
        </div>
      ),
    },
    {
      title: "What the Student Did Well",
      tone: "green" as const,
      content: valueList(detailedStrengths, "Not enough evidence available"),
    },
    {
      title: "Where the Student Struggled",
      tone: "amber" as const,
      content: valueList(detailedWeaknesses, "Not enough evidence available"),
    },
    {
      title: "Recommended Next Steps",
      tone: "blue" as const,
      content: (
        <div className="grid gap-3">
          <p>{report.training_recommendation || "Not available"}</p>
          <p>{report.teacher_action || "Not available"}</p>
          {teacherActions.length ? (
            <div className="flex flex-wrap gap-2">
              {teacherActions.map((action) => (
                <span key={action} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {action}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: "Risk Signals",
      tone: "red" as const,
      content: (
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${riskClasses(report.brute_force_risk)}`}>
              Basic Foundation Risk: {report.brute_force_risk || "Not available"}
            </span>
            <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${riskClasses(report.hardcoding_risk)}`}>
              Higher Concept Risk: {report.hardcoding_risk || "Not available"}
            </span>
            <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${readinessClasses(readinessBucket)}`}>
              Readiness: {readinessBucket}
            </span>
          </div>
          <div className="grid gap-3">
            {valueTable([
              { label: "Readiness Reason", value: report.readiness_reason },
              { label: "Risk Summary", value: report.risk_summary },
              { label: "Compilation Behaviour", value: report.compilation_behaviour },
              { label: "Runtime Percentile", value: report.runtime_percentile },
              { label: "Integrity Status", value: integrity?.status },
              { label: "Integrity Source", value: integrity?.source },
              { label: "Integrity Message", value: integrity?.message },
              { label: "Integrity Event Count", value: integrity?.event_count },
            ])}
          </div>
        </div>
      ),
    },
    {
      title: "Evidence Used by AI",
      tone: "blue" as const,
      content: (
        <div className="grid gap-4">
          {valueTable([
            { label: "Dashboard Evaluation Output", value: dashboardOutput },
            { label: "Dashboard Input", value: dashboardInput },
            { label: "Deterministic Readiness", value: deterministicReadiness },
          ])}
        </div>
      ),
    },
  ];

  return (
    <div className={printMode ? "grid gap-6 bg-white text-slate-950" : "grid gap-6"}>
      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="grid gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
                Assessment Report
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                {report.assessment_title || "Assessment report"}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                AI-based evaluation summary for this student assessment attempt.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-slate-700">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium">{profile?.full_name || "Unnamed student"}</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium">{profile?.roll_number || "No roll number"}</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium">{profile?.email || studentId}</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium">Batch: {batchName}</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium">College: {collegeName}</span>
              <span className={`rounded-full border px-3 py-1.5 font-semibold ${readinessClasses(readinessBucket)}`}>{readinessBucket}</span>
            </div>
          </div>

          {!printMode ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/reports"
                className="inline-flex items-center justify-center gap-2 rounded-[12px] border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft size={16} />
                Back to Reports
              </Link>
              <Link
                href={generateStudentReportPdf(studentId, attemptId)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-[12px] border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
              >
                <ScrollText size={16} />
                Download PDF
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
        <div className="grid gap-2">
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-slate-500">Student Details</p>
          <div className="grid gap-2 text-sm leading-6 text-slate-700">
            <p><span className="font-semibold text-slate-900">Name:</span> {profile?.full_name || "Not available"}</p>
            <p><span className="font-semibold text-slate-900">Roll number:</span> {profile?.roll_number || "Not available"}</p>
            <p><span className="font-semibold text-slate-900">Email:</span> {profile?.email || "Not available"}</p>
            <p><span className="font-semibold text-slate-900">Student ID:</span> {studentId}</p>
            <p><span className="font-semibold text-slate-900">College:</span> {collegeName}</p>
            <p><span className="font-semibold text-slate-900">Batch:</span> {batchName}</p>
          </div>
        </div>
        <div className="grid gap-2">
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-slate-500">Assessment Details</p>
          <div className="grid gap-2 text-sm leading-6 text-slate-700">
            <p><span className="font-semibold text-slate-900">Assessment:</span> {report.assessment_title || "Not available"}</p>
            <p><span className="font-semibold text-slate-900">Attempted:</span> {latestReportDate}</p>
            <p><span className="font-semibold text-slate-900">Assessment Type:</span> Assessment report</p>
            <p><span className="font-semibold text-slate-900">Completion:</span> {report.readiness_label || "Not available"}</p>
            <p><span className="font-semibold text-slate-900">Attempt ID:</span> {attemptId}</p>
          </div>
        </div>
        <div className="grid gap-2">
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-slate-500">Teacher Snapshot</p>
          <div className="grid gap-2 text-sm leading-6 text-slate-700">
            <p><span className="font-semibold text-slate-900">Overall Status:</span> {readinessBucket}</p>
            <p><span className="font-semibold text-slate-900">Main Gap:</span> {report.weakest_section || "Not available"}</p>
            <p><span className="font-semibold text-slate-900">Priority:</span> {report.training_priority || "Not available"}</p>
            <p><span className="font-semibold text-slate-900">Strength:</span> {report.strongest_section || "Not available"}</p>
            <p><span className="font-semibold text-slate-900">Submitted:</span> {latestReportDate}</p>
          </div>
        </div>
        <div className="grid gap-2">
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-slate-500">Quick Controls</p>
          <div className="grid gap-2 text-sm leading-6 text-slate-700">
            <p className="rounded-[14px] border border-emerald-200 bg-emerald-50 px-3 py-2 font-semibold text-emerald-900">Download PDF from the action button above.</p>
            <p className="rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2">The report below keeps all values visible in teacher-friendly language.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        {summaryMetrics.map((item) => (
          <article key={item.label} className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{item.label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{item.value}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.helper}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-slate-950">
          <Sparkles size={18} className="text-emerald-700" />
          <h2 className="text-lg font-semibold">AI Evaluation Summary</h2>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {aiSummarySections.map((section) => (
            <section
              key={section.title}
              className={`rounded-[20px] border p-5 ${
                section.tone === "green"
                  ? "border-emerald-200 bg-emerald-50"
                  : section.tone === "amber"
                    ? "border-amber-200 bg-amber-50"
                    : section.tone === "red"
                      ? "border-red-200 bg-red-50"
                      : "border-slate-200 bg-slate-50"
              }`}
            >
              <h3 className="text-base font-semibold text-slate-950">{section.title}</h3>
              <div className="mt-4">{section.content}</div>
            </section>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-slate-950">
          <Gauge size={18} className="text-emerald-700" />
          <h2 className="text-lg font-semibold">Skill Score Breakdown</h2>
        </div>
        <div className="mt-5 overflow-hidden rounded-[18px] border border-slate-200">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Skill Area</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Interpretation</th>
                <th className="px-4 py-3 font-medium">Teacher Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {skillRows.map((item) => {
                const Icon = skillIcon(item.label);
                return (
                  <tr key={item.label} className="align-top">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 font-semibold text-slate-950">
                        <Icon size={16} className="text-emerald-700" />
                        {item.label}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-950">{item.value} / 100</td>
                    <td className="px-4 py-4 text-slate-700">{interpretScore(item.value)}</td>
                    <td className="px-4 py-4 text-slate-700">{item.helper}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-slate-950">
          <BadgeCheck size={18} className="text-emerald-700" />
          <h2 className="text-lg font-semibold">Question-Wise Evaluation</h2>
        </div>
        <div className="mt-5 grid gap-4">
          {groupedSections.map((group) => {
            const GroupIcon = group.Icon;

            if (group.section === "MCQ") {
              return (
                <details key={group.section} className="group rounded-[20px] border border-slate-200 bg-slate-50 p-4" open>
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-slate-950">
                        <GroupIcon size={18} className="text-emerald-700" />
                        <h3 className="text-base font-semibold">{group.section}</h3>
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {group.questions.length} questions
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <ChevronDown size={14} className="transition group-open:rotate-180" />
                        Expand to view all MCQ details at once.
                      </div>
                    </div>
                  </summary>

                  <div className="mt-4 grid gap-4">
                    {group.questions.map((question, index) => {
                      const evaluation = evaluationByQuestionId.get(question.question_id);
                      const mcq = mcqByQuestionId.get(question.question_id);
                      const evaluationOutput = asRecord(normalizeAiEvaluation(evaluation?.ai_evaluation)?.output);
                      const questionTitle =
                        safeText(
                          evaluationOutput?.question_title || evaluationOutput?.title || evaluationOutput?.question || question.question_id,
                          question.question_id,
                        ) || question.question_id;
                      const questionScore = clampScore(evaluation?.final_score);
                      const parameterRows = sectionParameterRows({
                        section: group.section,
                        evaluationOutput,
                        mcq,
                      });
                      const evidenceRows = sectionEvidenceRows({
                        section: group.section,
                        question,
                      });

                      return (
                        <article key={question.question_id} className="rounded-[18px] border border-slate-200 bg-white p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">Question {index + 1}</p>
                              <h4 className="mt-1 text-lg font-semibold text-slate-950">{questionTitle}</h4>
                              <p className="mt-1 text-xs text-slate-500">Topic / skill area: {group.section}</p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Marks {questionScore} / 100</span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Status {question.status || "Not available"}</span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Runs {question.run_count ?? 0}</span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Submits {question.submit_count ?? 0}</span>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
                            <section className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
                              <div className="flex items-center gap-2 text-slate-950">
                                <ScrollText size={16} />
                                <h5 className="font-semibold">Student Input</h5>
                              </div>
                              <div className="mt-3 grid gap-3 text-sm leading-6 text-slate-700">
                                <p>
                                  <span className="font-semibold text-slate-900">Question ID:</span> {question.question_id}
                                </p>
                                <p>
                                  <span className="font-semibold text-slate-900">Marked for review:</span> {question.marked_for_review ? "Yes" : "No"}
                                </p>
                                <p>
                                  <span className="font-semibold text-slate-900">Last autosaved:</span> {formatDateTime(question.last_autosaved_at)}
                                </p>
                                <p>
                                  <span className="font-semibold text-slate-900">Selected language:</span> {question.selected_language || "Not available"}
                                </p>
                                <div>
                                  <p className="font-semibold text-slate-900">Selected options</p>
                                  <p className="mt-2 rounded-[14px] border border-slate-200 bg-white px-3 py-2">
                                    {asStringArray(question.selected_options).join(", ") || "Not available"}
                                  </p>
                                </div>
                              </div>
                            </section>

                            <section className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
                              <div className="flex items-center gap-2 text-slate-950">
                                <Sparkles size={16} />
                                <h5 className="font-semibold">Scoring Parameters and Evidence</h5>
                              </div>
                              <div className="mt-3 grid gap-4 text-sm leading-6 text-slate-700">
                                <p className="text-xs text-slate-500">Scores in this panel are shown on a 100-point scale.</p>
                                <div className="grid gap-2 rounded-[14px] border border-slate-200 bg-white p-3">
                                  <p>
                                    <span className="font-semibold text-slate-900">Final score (out of 100):</span> {evaluation?.final_score ?? "Not available"}
                                  </p>
                                  <p>
                                    <span className="font-semibold text-slate-900">Interpretation:</span> {interpretScore(questionScore)}
                                  </p>
                                </div>
                                <div className="rounded-[14px] border border-slate-200 bg-white p-3">
                                  <p className="font-semibold text-slate-900">Scoring parameters</p>
                                  <div className="mt-3">{valueTable(parameterRows, true, true)}</div>
                                </div>
                                {/* <div className="rounded-[14px] border border-slate-200 bg-white p-3">
                                  <p className="font-semibold text-slate-900">Supporting evidence</p>
                                  <div className="mt-3">{valueTable(evidenceRows, true)}</div>
                                </div> */}
                              </div>
                            </section>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </details>
              );
            }

            return (
              <section key={group.section} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-slate-950">
                  <GroupIcon size={18} className="text-emerald-700" />
                  <h3 className="text-base font-semibold">{group.section}</h3>
                </div>

                <div className="mt-4 grid gap-4">
                  {group.questions.map((question, index) => {
                    const evaluation = evaluationByQuestionId.get(question.question_id);
                    const codeRun = latestCodeRunByQuestionId.get(question.question_id);
                    const sqlRun = latestSqlRunByQuestionId.get(question.question_id);
                    const mcq = mcqByQuestionId.get(question.question_id);
                    const evaluationOutput = asRecord(normalizeAiEvaluation(evaluation?.ai_evaluation)?.output);
                    const questionTitle =
                      safeText(
                        evaluationOutput?.question_title || evaluationOutput?.title || evaluationOutput?.question || question.question_id,
                        question.question_id,
                      ) || question.question_id;
                    const questionScore = clampScore(evaluation?.final_score);
                    const parameterRows = sectionParameterRows({
                      section: group.section,
                      evaluationOutput,
                      codeRun,
                      sqlRun,
                      mcq,
                    });
                    const evidenceRows = sectionEvidenceRows({
                      section: group.section,
                      question,
                      codeRun,
                      sqlRun,
                    });

                    return (
                      <details key={question.question_id} className="group rounded-[18px] border border-slate-200 bg-white p-4" open={index === 0}>
                        <summary className="cursor-pointer list-none">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">Question {index + 1}</p>
                              <h4 className="mt-1 text-lg font-semibold text-slate-950">{questionTitle}</h4>
                              <p className="mt-1 text-xs text-slate-500">Topic / skill area: {group.section}</p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Marks {questionScore} / 100</span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Status {question.status || "Not available"}</span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Runs {question.run_count ?? 0}</span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Submits {question.submit_count ?? 0}</span>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                            <ChevronDown size={14} className="transition group-open:rotate-180" />
                            Expand to view student input, AI output, evidence, and validation details.
                          </div>
                        </summary>

                        <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr]">
                          <section className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center gap-2 text-slate-950">
                              <ScrollText size={16} />
                              <h5 className="font-semibold">Student Input</h5>
                            </div>
                            <div className="mt-3 grid gap-3 text-sm leading-6 text-slate-700">
                              <p>
                                <span className="font-semibold text-slate-900">Question ID:</span> {question.question_id}
                              </p>
                              <p>
                                <span className="font-semibold text-slate-900">Marked for review:</span> {question.marked_for_review ? "Yes" : "No"}
                              </p>
                              <p>
                                <span className="font-semibold text-slate-900">Last autosaved:</span> {formatDateTime(question.last_autosaved_at)}
                              </p>
                              <p>
                                <span className="font-semibold text-slate-900">Selected language:</span> {question.selected_language || "Not available"}
                              </p>
                              <div>
                                <p className="font-semibold text-slate-900">Answer / submission</p>
                                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-[14px] bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100">
                                  {submissionTextForQuestion({
                                    section: group.section,
                                    question,
                                    codeRun,
                                    sqlRun,
                                  })}
                                </pre>
                              </div>
                              {question.selected_options ? (
                                <div>
                                  <p className="font-semibold text-slate-900">Selected options</p>
                                  <p className="mt-2 rounded-[14px] border border-slate-200 bg-white px-3 py-2">
                                    {asStringArray(question.selected_options).join(", ") || "Not available"}
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          </section>

                          <section className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center gap-2 text-slate-950">
                              <Sparkles size={16} />
                              <h5 className="font-semibold">Scoring Parameters and Evidence</h5>
                            </div>
                            <div className="mt-3 grid gap-4 text-sm leading-6 text-slate-700">
                              <p className="text-xs text-slate-500">Scores in this panel are shown on a 100-point scale.</p>
                              <div className="grid gap-2 rounded-[14px] border border-slate-200 bg-white p-3">
                                <p>
                                  <span className="font-semibold text-slate-900">Final score (out of 100):</span> {evaluation?.final_score ?? "Not available"}
                                </p>
                                <p>
                                  <span className="font-semibold text-slate-900">Interpretation:</span> {interpretScore(questionScore)}
                                </p>
                              </div>
                              <div className="rounded-[14px] border border-slate-200 bg-white p-3">
                                <p className="font-semibold text-slate-900">Scoring parameters</p>
                                <div className="mt-3">{valueTable(parameterRows, true, true)}</div>
                              </div>
                              {/* <div className="rounded-[14px] border border-slate-200 bg-white p-3">
                                <p className="font-semibold text-slate-900">Supporting evidence</p>
                                <div className="mt-3">{valueTable(evidenceRows, true)}</div>
                              </div> */}
                            </div>
                          </section>
                        </div>
                      </details>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-950">
            <Target size={18} className="text-emerald-700" />
            <h2 className="text-lg font-semibold">Recommended Teacher Actions</h2>
          </div>
          <div className="mt-4 grid gap-2">
            {(teacherActions.length ? teacherActions : ["No explicit action available"]).map((action) => (
              <div key={action} className="rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700">
                {action}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-950">
            <Layers3 size={18} className="text-emerald-700" />
            <h2 className="text-lg font-semibold">Strengths and Learning Gaps</h2>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 p-4">
              <p className="font-semibold text-emerald-900">Strengths</p>
              <div className="mt-3">{valueList(detailedStrengths, "Not enough evidence available")}</div>
            </div>
            <div className="rounded-[18px] border border-amber-200 bg-amber-50 p-4">
              <p className="font-semibold text-amber-900">Learning Gaps</p>
              <div className="mt-3">{valueList(detailedWeaknesses, "Not enough evidence available")}</div>
            </div>
          </div>
        </section>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-slate-950">
          <ShieldAlert size={18} className="text-emerald-700" />
          <h2 className="text-lg font-semibold">Validation Review</h2>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-2 text-sm leading-6 text-slate-700">
              <p><span className="font-semibold text-slate-900">Validation status:</span> {report.compilation_behaviour || "Not available"}</p>
              <p><span className="font-semibold text-slate-900">Common failure reason:</span> {safeText(deterministicReadiness?.reason || report.readiness_reason, "Not available")}</p>
              <p><span className="font-semibold text-slate-900">Related risk signal:</span> {report.brute_force_risk || "Not available"} / {report.hardcoding_risk || "Not available"}</p>
            </div>
          </div>
          <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">Teacher-friendly interpretation</p>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              {readinessBucket === "Ready"
                ? "The student is performing at a level that looks ready for the next stage, with only routine review needed."
                : readinessBucket === "Training Needed"
                  ? "The student shows partial readiness and needs targeted practice before the next assessment or review."
                  : "The student needs direct support and a focused review plan before moving ahead."}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-slate-950">
          <FileText size={18} className="text-emerald-700" />
          <h2 className="text-lg font-semibold">Additional Report Data</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          The following sections flatten the remaining loaded report data so no value is hidden from the teacher.
        </p>
        <div className="mt-5 grid gap-4">
          {valueTable([
            { label: "Readiness Reason", value: report.readiness_reason },
            { label: "Risk Summary", value: report.risk_summary },
            { label: "Dashboard Evaluation Output", value: dashboardOutput },
            { label: "Dashboard Input", value: dashboardInput },
            { label: "Deterministic Readiness", value: deterministicReadiness },
            { label: "Integrity", value: integrity },
          ])}
        </div>
      </section>
    </div>
  );
}
