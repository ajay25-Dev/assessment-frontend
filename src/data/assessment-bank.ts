export type AssessmentSectionId = "DSA" | "SQL" | "OOPs" | "MCQ";
export type AssessmentEngine = "code" | "sql" | "mcq";

export type AssessmentLanguage = {
  id: string;
  label: string;
  judge0_language_id: number;
};

export type AssessmentSecurityPolicy = {
  tab_switch_protection_enabled?: boolean;
  max_tab_switch_events?: number;
  auto_submit_on_max_events?: boolean;
  camera_proctoring_enabled?: boolean;
  max_camera_events?: number;
  auto_submit_on_camera_events?: boolean;
  copy_paste_block_enabled?: boolean;
  inspect_mode_block_enabled?: boolean;
  restart_timer_on_login?: boolean;
  assessment_scoring_details_enabled?: boolean;
};

const compilerVersionLabels: Record<string, string> = {
  python: "Python 3.12",
  java: "Java 21",
  cpp: "C++ 20 (GCC 14)",
  c: "C23 (GCC 14)",
  sql: "PostgreSQL 15",
};

export function getLanguageDisplayLabel(language: Pick<AssessmentLanguage, "id" | "label">) {
  return compilerVersionLabels[language.id] || language.label;
}

export type AssessmentQuestion = {
  id: string;
  section: AssessmentSectionId;
  engine: AssessmentEngine;
  type: string;
  title: string;
  topic?: string;
  difficulty?: string;
  marks?: number;
  prompt: string;
  constraints?: string[];
  function_signature?: string;
  expected_approach?: string[];
  expected_code?: string[];
  expected_time_complexity?: string;
  expected_space_complexity?: string;
  ideal_time?: number;
  ideal_space?: number;
  evaluator_context?: unknown;
  schema_ref?: string;
  misconception_mapping?: unknown;
  test_cases?: Array<{
    number: number;
    input: string;
    expected?: string;
    expected_output: string;
    purpose: string;
    tags?: string[];
  }>;
  open_test_cases?: Array<{
    number: number;
    input: string;
    expected?: string;
    expected_output: string;
    purpose: string;
    tags?: string[];
  }>;
  hidden_test_cases?: Array<{
    number: number;
    input: string;
    expected?: string;
    expected_output: string;
    purpose: string;
    tags?: string[];
  }>;
  allowed_languages?: string[];
  starter_code?: Record<string, string>;
  dialect?: string;
  expected_columns?: string[];
  visible_expected_rows?: unknown[];
  result_match?: {
    order_matters?: boolean;
    numeric_tolerance?: number;
  };
  required_business_rules?: string[];
  expected_sql_concepts?: string[];
  expected_sql_concept_tags?: string[];
  edge_cases?: string[];
  null_rules?: string[];
  duplicate_rules?: string[];
  sample_data_sql?: string;
  sample_data_tables?: Array<{
    name: string;
    columns: string[];
    rows: string[][];
  }>;
  options?: Array<{ label: string; text: string }>;
  correct_options?: string[];
  allow_multiple_answers?: boolean;
  explanation?: string;
};

export type AssessmentBank = {
  assessment: {
    id: string;
    title: string;
    description: string;
    duration_minutes: number;
    scoring_weights: Record<AssessmentSectionId, number>;
    security?: AssessmentSecurityPolicy;
    sections: Array<{
      id: string;
      name: AssessmentSectionId;
      duration_minutes: number;
      question_count: number;
      recommended_minutes_per_question: number;
    }>;
  };
  languages: AssessmentLanguage[];
  questions: AssessmentQuestion[];
};

export const sectionOrder: AssessmentSectionId[] = ["DSA", "SQL", "OOPs", "MCQ"];


