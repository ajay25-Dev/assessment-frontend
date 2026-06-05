export type AssessmentSectionId = "DSA" | "SQL" | "OOPs" | "MCQ";
export type AssessmentEngine = "code" | "sql" | "mcq";

export type AssessmentLanguage = {
  id: string;
  label: string;
  judge0_language_id: number;
};

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
  test_cases?: Array<{
    number: number;
    input: string;
    expected_output: string;
    purpose: string;
  }>;
  allowed_languages?: string[];
  starter_code?: Record<string, string>;
  dialect?: string;
  expected_columns?: string[];
  options?: Array<{ label: string; text: string }>;
  correct_options?: string[];
  explanation?: string;
};

export type AssessmentBank = {
  assessment: {
    id: string;
    title: string;
    description: string;
    duration_minutes: number;
    scoring_weights: Record<AssessmentSectionId, number>;
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
