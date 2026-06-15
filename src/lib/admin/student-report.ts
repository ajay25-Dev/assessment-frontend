export type ReadinessBucket = "Ready" | "Training Needed" | "Failed";

export type ReportRow = {
  id: string;
  student_id: string | null;
  attempt_id: string | null;
  assessment_title: string | null;
  marks_score: number | null;
  capability_score: number | null;
  problem_solving_score: number | null;
  dsa_score: number | null;
  sql_score: number | null;
  oops_score: number | null;
  mcq_score: number | null;
  approach_score: number | null;
  complexity_score: number | null;
  code_quality_score: number | null;
  hidden_test_pass_rate: number | null;
  brute_force_risk: string | null;
  hardcoding_risk: string | null;
  compilation_behaviour: string | null;
  runtime_percentile: string | null;
  readiness_label: string | null;
  readiness_bucket: string | null;
  readiness_reason: unknown;
  strongest_section: string | null;
  weakest_section: string | null;
  training_priority: string | null;
  training_recommendation: string | null;
  teacher_action: string | null;
  risk_summary: unknown;
  faculty_insight: string | null;
  company_recommendation: string | null;
  student_summary: string | null;
  detailed_strengths: unknown;
  detailed_weaknesses: unknown;
  next_3_learning_actions: unknown;
  report_json: unknown;
  created_at: string | null;
};

export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  roll_number: string | null;
};

export type QuestionAttemptRow = {
  id: string;
  attempt_id: string;
  question_id: string;
  section: string;
  answer_text: string | null;
  selected_language: string | null;
  selected_options: unknown;
  marked_for_review: boolean | null;
  status: string | null;
  run_count: number | null;
  submit_count: number | null;
  last_autosaved_at: string | null;
};

export type QuestionEvaluationRow = {
  question_id: string;
  section: string;
  deterministic_score: number | null;
  ai_evaluation: unknown;
  final_score: number | null;
};

export type CodeRunRow = {
  question_id: string;
  language: string | null;
  run_type: string | null;
  source_code: string | null;
  status: string | null;
  open_tests_passed: number | null;
  open_tests_total: number | null;
  hidden_tests_passed: number | null;
  hidden_tests_total: number | null;
  raw_provider_response: unknown;
  created_at: string | null;
};

export type SqlRunRow = {
  question_id: string;
  run_type: string | null;
  query_text: string | null;
  row_count: number | null;
  error_text: string | null;
  comparison_result: unknown;
  created_at: string | null;
};

export type McqAnswerRow = {
  question_id: string;
  selected_options: unknown;
  is_correct: boolean | null;
};

export type SkillScoreRow = {
  label: string;
  value: number;
  helper: string;
};

export type ReportValuePair = {
  label: string;
  value: string;
  depth: number;
};

export type SectionEvaluationRecord = {
  section: string;
  output?: Record<string, unknown>;
};

export function safeText(value: unknown, fallback = "Not available") {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    const text = value.trim();
    return text.length ? text : fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

export function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clampScore(value: unknown) {
  return Math.max(0, Math.min(100, Math.round(safeNumber(value, 0))));
}

export function formatScore(value: unknown, suffix = "/ 100") {
  return `${clampScore(value)} ${suffix}`.trim();
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function humanizeKey(key: string) {
  const replaced = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  if (!replaced) return "Value";
  return replaced
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function mapTechnicalLabelToTeacherLabel(key: string) {
  const normalized = key.trim().toLowerCase();
  const map: Record<string, string> = {
    avg_marks: "Overall Score",
    marks_score: "Overall Score",
    total_marks: "Overall Score",
    score: "Overall Score",
    avg_capability: "Problem Solving Score",
    capability_score: "Problem Solving Score",
    problem_solving_score: "Problem Solving Score",
    capability: "Problem Solving Score",
    readiness: "Readiness Status",
    readiness_status: "Readiness Status",
    training_needed: "Needs Practice",
    failed: "Needs Immediate Support",
    ready: "Ready for Next Level",
    weakness: "Main Learning Gap",
    weak_area: "Main Learning Gap",
    main_weakness: "Main Learning Gap",
    recommendation: "Recommended Next Steps",
    training_direction: "Recommended Next Steps",
    next_steps: "Recommended Next Steps",
    bf_low: "Basic Foundation Risk",
    hc_low: "Higher Concept Risk",
    dsa_score: "DSA Performance",
    sql_score: "SQL Performance",
    oops_score: "OOPs Performance",
    mcq_score: "MCQ Performance",
    ai_summary: "AI Evaluation Summary",
    teacher_summary: "Teacher Summary",
    evaluation_reason: "Why the AI Gave This Evaluation",
    expected_approach_match: "Expected Approach Used",
    detected_approach: "Detected Approach",
    expected_code_score: "Expected Code Checklist Score",
    matched_expected_code: "Matched Expected Code",
    missing_expected_code: "Missing Expected Code",
    expected_time_complexity_rank: "Expected Time Complexity Rank",
    student_time_complexity_rank: "Student Time Complexity Rank",
    time_complexity_rank_gap: "Time Complexity Rank Gap",
    expected_space_complexity_rank: "Expected Space Complexity Rank",
    student_space_complexity_rank: "Student Space Complexity Rank",
    space_complexity_rank_gap: "Space Complexity Rank Gap",
    correctness_score: "Correctness Score",
    open_test_case_score: "Open Test Case Score",
    hidden_test_case_score: "Hidden Test Case Score",
    time_complexity_score: "Time Complexity Score",
    space_complexity_score: "Space Complexity Score",
    edge_case_score: "Edge Case Score",
    code_quality_score: "Code Quality Score",
    overall_question_score: "Overall Question Score",
    result_correctness_score: "Result Correctness Score",
    business_logic_score: "Business Logic Score",
    sql_concept_score: "SQL Concept Score",
    query_efficiency_score: "Query Efficiency Score",
    readability_score: "Readability Score",
    null_duplicate_handling_score: "NULL / Duplicate Handling Score",
    query_quality_label: "Query Quality Label",
    expected_concepts_used: "Expected Concepts Used",
    missing_concepts: "Missing Concepts",
    detected_mistakes: "Detected Mistakes",
    missing_business_rules: "Missing Business Rules",
    class_design_score: "Class Design Score",
    abstraction_score: "Abstraction Score",
    encapsulation_score: "Encapsulation Score",
    polymorphism_score: "Polymorphism Score",
    extensibility_score: "Extensibility Score",
    separation_of_concerns_score: "Separation of Concerns Score",
    solid_principles_score: "SOLID Principles Score",
    error_handling_score: "Error Handling Score",
    code_readability_score: "Code Readability Score",
    design_pattern_awareness_score: "Design Pattern Awareness Score",
    design_maturity_label: "Design Maturity Label",
    identified_classes: "Identified Classes",
    identified_interfaces_or_abstractions: "Identified Interfaces / Abstractions",
    design_patterns_detected: "Design Patterns Detected",
    missing_components: "Missing Components",
    red_flags: "Red Flags",
    optimization_level: "Optimization Level",
    brute_force_risk: "Brute Force Risk",
    hardcoding_risk: "Hardcoding Risk",
    guessing_risk: "Guessing Risk",
    confidence_signal: "Confidence Signal",
    revision_recommendation: "Revision Recommendation",
    topic_scores: "Topic Scores",
    subject_scores: "Subject Scores",
    learned_concepts: "Learned Concepts",
    student_answer: "Student Answer",
    expected_answer: "Expected Answer",
    submitted_code: "Submitted Code",
    test_cases: "Test Case Results",
    raw_response: "AI Response Details",
    evaluation_payload: "Evaluation Details",
    question_results: "Question Results",
  };

  return map[normalized] || humanizeKey(key);
}

export function normalizeRisk(value: string | null | undefined) {
  const risk = String(value || "").trim().toLowerCase();
  if (risk === "high") return "High";
  if (risk === "medium") return "Medium";
  return "Low";
}

export function normalizeBucket(value: string | null | undefined, label: string | null | undefined): ReadinessBucket {
  const bucket = String(value || "").trim().toLowerCase();
  if (bucket === "ready") return "Ready";
  if (bucket === "training needed") return "Training Needed";
  if (bucket === "failed") return "Failed";

  const readiness = String(label || "").trim().toLowerCase();
  if (readiness === "elite 1% company ready" || readiness === "strong company ready") return "Ready";
  if (readiness === "near ready" || readiness === "trainable but not ready") return "Training Needed";
  if (readiness === "risky high scorer" || readiness === "not ready") return "Failed";
  if (readiness.includes("risk") || readiness.includes("fail")) return "Failed";
  if (readiness.includes("need") || readiness.includes("practice") || readiness.includes("train")) return "Training Needed";
  return "Ready";
}

export function readinessClasses(value: ReadinessBucket) {
  if (value === "Failed") {
    return "border-[var(--status-critical-border)] bg-[var(--status-critical-bg)] text-[var(--status-critical-text)]";
  }
  if (value === "Training Needed") {
    return "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]";
  }
  return "border-[var(--status-ready-border)] bg-[var(--status-ready-bg)] text-[var(--status-ready-text)]";
}

export function riskClasses(value: string | null | undefined) {
  const risk = normalizeRisk(value);
  if (risk === "High") {
    return "border-[var(--status-critical-border)] bg-[var(--status-critical-bg)] text-[var(--status-critical-text)]";
  }
  if (risk === "Medium") {
    return "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]";
  }
  return "border-[var(--status-ready-border)] bg-[var(--status-ready-bg)] text-[var(--status-ready-text)]";
}

export function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

export function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => (typeof item === "string" ? item.trim() : String(item)))
        .filter((item) => item.length > 0)
    : [];
}

export function asSectionEvaluationArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => {
          const record = asRecord(item);
          if (!record) return null;
          return {
            section: textValue(record.section),
            output: asRecord(record.output) || undefined,
          } satisfies SectionEvaluationRecord;
        })
        .filter(Boolean) as SectionEvaluationRecord[]
    : [];
}

export function normalizeAiEvaluation(value: unknown) {
  const record = asRecord(value);
  if (!record) return null;
  const output = asRecord(record.output);
  return {
    ...record,
    output,
  };
}

export function interpretScoreBand(value: unknown) {
  const score = clampScore(value);
  if (score <= 30) return "Critical Gap";
  if (score <= 60) return "Needs Practice";
  if (score <= 80) return "Developing";
  return "Strong";
}

export function normalizeReadinessLabel(value: string | null | undefined) {
  if (!value) return "Not available";
  const normalized = value.trim().toLowerCase();
  if (normalized === "ready") return "Ready for Next Level";
  if (normalized === "training needed") return "Needs Practice";
  if (normalized === "failed") return "Needs Immediate Support";
  return value;
}

export function buildNextBestStep(report: Pick<ReportRow, "training_priority" | "training_recommendation" | "company_recommendation" | "teacher_action" | "weakest_section">) {
  return (
    report.training_recommendation ||
    report.teacher_action ||
    report.training_priority ||
    report.company_recommendation ||
    (report.weakest_section ? `Review ${report.weakest_section} fundamentals.` : "")
  );
}

export function extractLatestSkillScores(report: ReportRow, reportJson: unknown) {
  const dashboardEvaluation = asRecord(asRecord(reportJson)?.dashboard_evaluation);
  const dashboardOutput = asRecord(dashboardEvaluation?.output);
  const sectionEvaluations = asSectionEvaluationArray(asRecord(reportJson)?.section_evaluations);
  const coreLabels = new Set(["overall score", "skill readiness", "dsa", "sql", "oops", "mcq", "approach score", "complexity score", "code quality score"]);
  const extraSectionScores = sectionEvaluations
    .map((entry) => {
      const normalizedSection = entry.section.trim().toLowerCase();
      if (!normalizedSection || coreLabels.has(normalizedSection)) return null;

      const output = entry.output || {};
      const score =
        numberValue(output.overall_question_score) ||
        numberValue(output.overall_mcq_score) ||
        numberValue(output.query_efficiency_score) ||
        numberValue(output.code_readability_score) ||
        numberValue(output.class_design_score) ||
        numberValue(output.approach_score) ||
        numberValue(output.code_quality_score);

      return score > 0
        ? {
            label: entry.section || "Additional Section",
            value: score,
            helper: buildTeacherActionFromOutput(entry.section, output),
          }
        : null;
    })
    .filter(Boolean) as SkillScoreRow[];

  return [
    { label: "Overall Score", value: clampScore(report.marks_score ?? dashboardOutput?.overall_marks_score), helper: "How the student performed overall in this assessment." },
    { label: "Problem Solving Score", value: clampScore(report.problem_solving_score ?? report.capability_score ?? dashboardOutput?.problem_solving_score ?? dashboardOutput?.capability_score), helper: "Deterministic score based on correctness, approach, complexity, edge cases, and code quality." },
    { label: "DSA", value: clampScore(report.dsa_score ?? dashboardOutput?.dsa_score), helper: "Algorithmic problem-solving and complexity control." },
    { label: "SQL", value: clampScore(report.sql_score ?? dashboardOutput?.sql_score), helper: "Query accuracy, logic, and output quality." },
    { label: "OOPs", value: clampScore(report.oops_score ?? dashboardOutput?.oops_score), helper: "Object design, abstraction, and maintainability." },
    { label: "MCQ", value: clampScore(report.mcq_score ?? dashboardOutput?.mcq_score), helper: "Concept recall and subject knowledge." },
    { label: "Approach Score", value: clampScore(report.approach_score ?? dashboardOutput?.approach_score), helper: "How well the solution strategy fits the problem." },
    { label: "Complexity Score", value: clampScore(report.complexity_score ?? dashboardOutput?.complexity_score), helper: "Time and space efficiency." },
    { label: "Code Quality Score", value: clampScore(report.code_quality_score ?? dashboardOutput?.code_quality_score), helper: "Readability, structure, and robustness." },
    ...extraSectionScores,
  ].filter((item) => item.value > 0 || item.label === "Overall Score" || item.label === "Problem Solving Score");
}

function buildTeacherActionFromOutput(section: string, output: Record<string, unknown>) {
  const sectionLabel = section ? `${section} ` : "";
  const texts = [
    textValue(output.improvement_recommendation),
    asStringArray(output.key_weaknesses).join(", "),
    asStringArray(output.missed_edge_cases).join(", "),
    asStringArray(output.missing_concepts).join(", "),
    asStringArray(output.failed_case_analysis).join(", "),
  ].filter(Boolean);
  if (texts.length) return texts.join(" ");
  return `${sectionLabel}needs review.`;
}

export function flattenNestedReportData(value: unknown, prefix = ""): ReportValuePair[] {
  if (value === null || value === undefined) {
    return prefix ? [{ label: prefix, value: "Not available", depth: 0 }] : [];
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return prefix ? [{ label: prefix, value: String(value), depth: 0 }] : [];
  }

  if (Array.isArray(value)) {
    if (!value.length) {
      return prefix ? [{ label: prefix, value: "Not available", depth: 0 }] : [];
    }

    const primitiveArray = value.every((item) => item === null || item === undefined || ["string", "number", "boolean"].includes(typeof item));
    if (primitiveArray) {
      return [
        {
          label: prefix || "Values",
          value: value.map((item) => String(item)).join(", "),
          depth: 0,
        },
      ];
    }

    return value.flatMap((item, index) => flattenNestedReportData(item, prefix ? `${prefix} ${index + 1}` : `Item ${index + 1}`));
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
      if (key.toLowerCase().includes("hidden")) return [];
      const label = prefix ? `${prefix} ${mapTechnicalLabelToTeacherLabel(key)}` : mapTechnicalLabelToTeacherLabel(key);
      const nested = flattenNestedReportData(child, label);
      if (nested.length === 0) {
        return [{ label, value: "Not available", depth: 0 }];
      }
      return nested.map((entry) => ({
        ...entry,
        depth: entry.depth + (prefix ? 1 : 0),
      }));
    });
  }

  return prefix ? [{ label: prefix, value: safeText(value), depth: 0 }] : [];
}

export function extractStrengths(value: unknown) {
  return asStringArray(value);
}

export function extractWeaknesses(value: unknown) {
  return asStringArray(value);
}

export function extractTeacherActions(report: Pick<ReportRow, "training_priority" | "training_recommendation" | "teacher_action" | "company_recommendation">) {
  return [
    report.training_priority,
    report.training_recommendation,
    report.teacher_action,
    report.company_recommendation,
  ].filter((item): item is string => Boolean(item && item.trim()));
}

export function extractSkillScores(report: Pick<ReportRow, "marks_score" | "capability_score" | "problem_solving_score" | "approach_score" | "complexity_score" | "code_quality_score" | "dsa_score" | "sql_score" | "oops_score" | "mcq_score" | "readiness_label" | "readiness_bucket" | "weakest_section" | "training_priority">): SkillScoreRow[] {
  const readiness = normalizeBucket(report.readiness_bucket, report.readiness_label);
  return [
    { label: "Overall Score", value: clampScore(report.marks_score), helper: "How the student performed overall in this assessment." },
    { label: "Problem Solving Score", value: clampScore(report.problem_solving_score ?? report.capability_score), helper: "Deterministic score based on correctness, approach, complexity, edge cases, and code quality." },
    { label: "Final Evaluation", value: readiness === "Ready" ? 100 : readiness === "Training Needed" ? 55 : 15, helper: `Current readiness: ${readiness}.` },
    { label: "Main Learning Gap", value: clampScore(100 - clampScore(report.marks_score)), helper: report.weakest_section || "Topic that needs the most attention." },
    { label: "Practice Priority", value: clampScore(report.training_priority ? 75 : 0), helper: report.training_priority || "No explicit priority given." },
    { label: "DSA Performance", value: clampScore(report.dsa_score), helper: "Algorithmic problem-solving and complexity control." },
    { label: "SQL Performance", value: clampScore(report.sql_score), helper: "Query accuracy, logic, and output quality." },
    { label: "OOPs Performance", value: clampScore(report.oops_score), helper: "Object design, abstraction, and maintainability." },
    { label: "MCQ Performance", value: clampScore(report.mcq_score), helper: "Concept recall and subject knowledge." },
    { label: "Approach Score", value: clampScore(report.approach_score), helper: "How well the solution strategy fits the problem." },
    { label: "Complexity Score", value: clampScore(report.complexity_score), helper: "Time and space efficiency." },
    { label: "Code Quality Score", value: clampScore(report.code_quality_score), helper: "Readability, structure, and robustness." },
  ];
}

export function generateStudentReportPdf(studentId: string, attemptId: string) {
  return `/admin/reports/students/${encodeURIComponent(studentId)}/attempts/${encodeURIComponent(attemptId)}/pdf`;
}
