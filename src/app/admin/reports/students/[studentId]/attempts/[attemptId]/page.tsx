import { notFound } from "next/navigation";
import { StudentAttemptReport } from "@/components/admin/student-attempt-report";
import {
  CodeRunRow,
  McqAnswerRow,
  ProfileRow,
  QuestionAttemptRow,
  QuestionEvaluationRow,
  ReportRow,
  SqlRunRow,
} from "@/lib/admin/student-report";
import { requireAdmin } from "@/lib/admin/supabase-admin";

export const dynamic = "force-dynamic";

type Params = Promise<{ studentId: string; attemptId: string }>;

export default async function AttemptReportCardPage({
  params,
}: {
  params: Params;
}) {
  const { studentId, attemptId } = await params;
  const { supabase } = await requireAdmin();

  const [
    { data: reportRow, error: reportError },
    { data: profileRow },
    { data: assignmentRows },
    { data: batchRows },
    { data: collegeRows },
    { data: questionAttemptRows },
    { data: evaluationRows },
    { data: codeRunRows },
    { data: sqlRunRows },
    { data: mcqRows },
  ] = await Promise.all([
    supabase
      .from("student_assessment_reports")
      .select(
        [
          "id",
          "student_id",
          "attempt_id",
          "assessment_title",
          "marks_score",
          "capability_score",
          "dsa_score",
          "sql_score",
          "oops_score",
          "mcq_score",
          "approach_score",
          "complexity_score",
          "code_quality_score",
          "hidden_test_pass_rate",
          "brute_force_risk",
          "hardcoding_risk",
          "compilation_behaviour",
          "runtime_percentile",
          "readiness_label",
          "readiness_bucket",
          "readiness_reason",
          "strongest_section",
          "weakest_section",
          "training_priority",
          "training_recommendation",
          "teacher_action",
          "risk_summary",
          "faculty_insight",
          "company_recommendation",
          "student_summary",
          "detailed_strengths",
          "detailed_weaknesses",
          "next_3_learning_actions",
          "report_json",
          "created_at",
        ].join(","),
      )
      .eq("student_id", studentId)
      .eq("attempt_id", attemptId)
      .maybeSingle(),
    supabase.from("profiles").select("id,email,full_name,roll_number").eq("id", studentId).maybeSingle(),
    supabase.from("batch_students").select("batch_id,student_id,created_at").eq("student_id", studentId).order("created_at", { ascending: false }),
    supabase.from("batches").select("id,name,college_id").order("name"),
    supabase.from("colleges").select("id,name").order("name"),
    supabase
      .from("student_question_attempts")
      .select("id,attempt_id,question_id,section,answer_text,selected_language,selected_options,marked_for_review,status,run_count,submit_count,last_autosaved_at")
      .eq("attempt_id", attemptId)
      .order("section")
      .order("question_id"),
    supabase
      .from("student_question_evaluations")
      .select("question_id,section,deterministic_score,ai_evaluation,final_score")
      .eq("attempt_id", attemptId)
      .order("section")
      .order("question_id"),
    supabase
      .from("student_code_runs")
      .select("question_id,language,run_type,source_code,status,open_tests_passed,open_tests_total,hidden_tests_passed,hidden_tests_total,raw_provider_response,created_at")
      .eq("attempt_id", attemptId)
      .order("created_at", { ascending: false }),
    supabase
      .from("student_sql_runs")
      .select("question_id,run_type,query_text,columns,rows,row_count,execution_ms,error_text,comparison_result,created_at")
      .eq("attempt_id", attemptId)
      .order("created_at", { ascending: false }),
    supabase
      .from("student_mcq_answers")
      .select("question_id,selected_options,is_correct")
      .eq("attempt_id", attemptId),
  ]);

  if (reportError) {
    throw new Error(`Could not load attempt report card: ${reportError.message}`);
  }

  const report = (reportRow || null) as ReportRow | null;
  const profile = (profileRow || null) as ProfileRow | null;
  const assignments = (assignmentRows || []) as { batch_id: string | null; student_id: string | null; created_at: string | null }[];
  const batches = (batchRows || []) as { id: string; name: string | null; college_id: string | null }[];
  const colleges = (collegeRows || []) as { id: string; name: string | null }[];
  const questionAttempts = (questionAttemptRows || []) as unknown as QuestionAttemptRow[];
  const evaluations = (evaluationRows || []) as unknown as QuestionEvaluationRow[];
  const codeRuns = (codeRunRows || []) as unknown as CodeRunRow[];
  const sqlRuns = (sqlRunRows || []) as unknown as SqlRunRow[];
  const mcqAnswers = (mcqRows || []) as unknown as McqAnswerRow[];

  if (!report) notFound();

  return (
    <StudentAttemptReport
      report={report}
      profile={profile}
      assignments={assignments}
      batches={batches}
      colleges={colleges}
      questionAttempts={questionAttempts}
      evaluations={evaluations}
      codeRuns={codeRuns}
      sqlRuns={sqlRuns}
      mcqAnswers={mcqAnswers}
      studentId={studentId}
      attemptId={attemptId}
    />
  );
}
