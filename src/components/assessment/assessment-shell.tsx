"use client";

import {
  BookOpen,
  Camera,
  CameraOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code2,
  Database,
  FileQuestion,
  Flag,
  Menu,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Save,
  Send,
  ShieldAlert,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { CodeEditor } from "@/components/editor/code-editor";
import { McqPanel } from "@/components/mcq/mcq-panel";
import { SqlResultGrid } from "@/components/sql/sql-result-grid";
import { supabaseBrowser } from "@/lib/supabase-browser";
import {
  getLanguageDisplayLabel,
  sectionOrder,
  type AssessmentBank,
  type AssessmentQuestion,
  type AssessmentSectionId,
} from "@/data/assessment-bank";

type AnswerState = {
  value: string;
  language: string;
  selectedOptions: string[];
  marked: boolean;
  runs: number;
  submissions: number;
  status: "unvisited" | "saved" | "ran" | "submitted";
  resultMessage: string;
  sqlExecutionMs: number | null;
  testResults?: TestResultsOutput | null;
};

type ActiveTab = "problem" | "answer" | "results";
type CameraPosition = { x: number; y: number };

type CompilerResponse = {
  status?: { id?: number; description?: string };
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  time?: string | null;
  memory?: number | null;
  test_results?: TestResultsOutput | null;
};

type TestResult = {
  number: number;
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  purpose: string;
  displayStatus?: "visible" | "executed";
};

type TestResultsOutput = {
  test_results: TestResult[];
  total: number;
  passed: number;
};

type TemporaryScorePreview = {
  label: string;
  score: string;
  detail: string;
  note: string;
  updatedAt: string;
};

type DsaCalculationOutput = {
  score: string;
  correctnessScore: number;
  openTestCaseScore: number;
  hiddenTestCaseScore: number | "Not available";
  expectedCodeScore: number;
  approachScore: number;
  timeComplexityScore: number | "Not available";
  spaceComplexityScore: number | "Not available";
  edgeCaseScore: number | "Not available";
  overallQuestionScore: number;
  passed: number;
  total: number;
  openTestsPassed: string;
  hiddenTestsPassed: string;
  totalTestsPassed: string;
  matchedExpectedCode: string[];
  missingExpectedCode: string[];
  expectedTimeComplexity: string;
  expectedTimeComplexityRank: number | "Not available";
  expectedTimeComplexityLabel: string;
  studentTimeComplexityRank: number | "Not available";
  studentTimeComplexityLabel: string;
  timeComplexityRankGap: number | "Not available";
  expectedSpaceComplexity: string;
  expectedSpaceComplexityRank: number | "Not available";
  expectedSpaceComplexityLabel: string;
  studentSpaceComplexityRank: number | "Not available";
  studentSpaceComplexityLabel: string;
  spaceComplexityRankGap: number | "Not available";
  expectedApproach: string[];
  expectedCode: string[];
  failedCaseAnalysis: string[];
  missedEdgeCases: string[];
  note: string;
  updatedAt: string;
};

type IntegrityViolation = {
  eventCount: number;
  message: string;
  source: "tab_switch" | "camera";
};

const defaultLanguage = "python";
const localProctoringOverride = process.env.NEXT_PUBLIC_DISABLE_PROCTORING;
const localProctoringDisabled =
  localProctoringOverride === "true" ||
  (process.env.NODE_ENV !== "production" && localProctoringOverride !== "false");
const defaultSectionDurations: Record<AssessmentSectionId, number> = {
  DSA: 90,
  SQL: 30,
  OOPs: 30,
  MCQ: 30,
};

type SectionStatus = "active" | "completed" | "unlocked";

type SqlRunResponse = {
  columns?: string[];
  rows?: Array<Record<string, string | number | boolean | null>>;
  row_count?: number;
  execution_ms?: number;
  error?: string;
  message?: string;
};

function sameStringSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function scoreRatio(passed: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((passed / total) * 100)));
}

function countPassed(results: TestResult[]) {
  return results.filter((result) => result.passed).length;
}

function visibleAndHiddenCounts(testResults: TestResultsOutput | null) {
  const results = testResults?.test_results || [];
  const visible = results.filter((test) => test.displayStatus === "visible");
  const hidden = results.filter((test) => test.displayStatus !== "visible");
  return {
    visible,
    hidden,
    visiblePassed: countPassed(visible),
    hiddenPassed: countPassed(hidden),
  };
}

function expectedCodeScore(expectedSignals: string[], code: string) {
  const uniqueSignals = [...new Set(expectedSignals.map((item) => item.trim()).filter(Boolean))];
  if (!uniqueSignals.length) return { score: 0, matched: [], missing: [] };

  const normalizedCode = normalizeText(code);
  const matched = uniqueSignals.filter((signal) => normalizedCode.includes(normalizeText(signal).replace(/\s+/g, "")));
  return {
    score: Math.max(0, Math.min(100, Math.round((matched.length / uniqueSignals.length) * 100))),
    matched,
    missing: uniqueSignals.filter((signal) => !matched.includes(signal)),
  };
}

function approachScore(expectedApproach: string[], code: string, correctnessScore: number) {
  const tokens = new Set(normalizeText(code).split(/\s+/).filter(Boolean));
  const matches = expectedApproach.map((item) => {
    const point = normalizeText(item);
    if (!point) return 0;
    const words = point.split(/\s+/).filter((word) => word.length > 2);
    if (!words.length) return 0;
    const matched = words.filter((word) => tokens.has(word)).length;
    if (matched >= Math.max(2, Math.ceil(words.length * 0.6))) return 1;
    if (matched >= Math.max(1, Math.ceil(words.length * 0.3))) return 0.5;
    return 0;
  });
  const matchPercentage = Math.max(
    0,
    Math.min(100, Math.round((matches.reduce((sum: number, value) => sum + value, 0) / (expectedApproach.length || 1)) * 100)),
  );
  return Math.max(0, Math.min(100, Math.round(0.75 * matchPercentage + 0.25 * correctnessScore)));
}

function resolveComplexityRankLocal(value: string) {
  const normalized = normalizeText(value).replace(/\s+/g, "");
  const rankings: Array<[number, string[]]> = [
    [1, ["o1", "constant", "constanttime", "constantspace"]],
    [3, ["ologn", "binarysearch", "balancedtree"]],
    [9, ["on", "linear", "depth", "totalversions", "versionchain", "depthperget", "o(depth)perget,o(1)perset".replace(/[^a-z0-9]/g, "")]],
    [11, ["onlogn", "heap", "priorityqueue", "sort"]],
    [16, ["on2", "quadratic", "doubleloop"]],
    [35, ["o2n", "2n", "exponential", "subset", "bitmask", "powerset"]],
    [41, ["on!", "factorial", "permutation"]],
    [50, ["unknown", "notavailable"]],
  ];

  for (const [rank, aliases] of rankings) {
    if (aliases.some((alias) => normalized.includes(alias))) return rank;
  }
  return 50;
}

function inferStudentComplexityRank(code: string) {
  const normalized = normalizeText(code);
  if (/(bitmask|subset|powerset)/.test(normalized)) return 35;
  if (/(memo|memoization|cache|dp)/.test(normalized)) return 9;
  if (/(heap|priority queue|priorityqueue|sort)/.test(normalized)) return 11;
  if (/(graph|bfs|dfs|adjacency|recursion)/.test(normalized)) return 9;
  if (/(double loop|nested loop|for .* for)/.test(normalized)) return 16;
  if (/(map|set|hash)/.test(normalized)) return 9;
  if (/(array|new array)/.test(normalized)) return 9;
  return 50;
}

function rankGapScore(expectedRank: number, studentRank: number) {
  const gap = studentRank - expectedRank;
  if (gap <= 0) return 100;
  return Math.max(0, 100 - gap * 10);
}

function complexityRankLabelLocal(rank: number | "Not available") {
  if (typeof rank !== "number") return "Not available";
  if (rank <= 1) return "O(1)";
  if (rank <= 3) return "O(log n)";
  if (rank <= 9) return "O(n)";
  if (rank <= 11) return "O(n log n)";
  if (rank <= 16) return "O(n^2)";
  if (rank <= 35) return "O(2^n)";
  if (rank <= 41) return "O(n!)";
  return "O(unknown)";
}

function visibleTestResultsForQuestion(question: AssessmentQuestion): TestResultsOutput | null {
  const cases = question.open_test_cases?.length ? question.open_test_cases : question.test_cases?.slice(0, 5) || [];
  if (!cases.length) return null;

  return {
    total: cases.length,
    passed: 0,
    test_results: cases.map((testCase, index) => ({
      number: Number(testCase.number || index + 1),
      input: String(testCase.input || ""),
      expected: String(testCase.expected_output || testCase.expected || ""),
      actual: "Run did not return structured per-case output.",
      passed: false,
      purpose: String(testCase.purpose || "Visible test case"),
      displayStatus: "visible",
    })),
  };
}

function initialAnswer(question: AssessmentQuestion): AnswerState {
  const language = question.engine === "sql" ? "sql" : question.allowed_languages?.[0] || defaultLanguage;
  return {
    value: question.starter_code?.[language] || (question.engine === "sql" ? "SELECT *\nFROM " : ""),
    language,
    selectedOptions: [],
    marked: false,
    runs: 0,
    submissions: 0,
    status: "unvisited",
    resultMessage: "No run yet.",
    sqlExecutionMs: null,
    testResults: null,
  };
}

function stripTransientAnswerData(answer: AnswerState): AnswerState {
  return {
    ...answer,
    testResults: null,
  };
}

function sanitizeAnswersForStorage(answers: Record<string, AnswerState>) {
  return Object.fromEntries(Object.entries(answers).map(([questionId, answer]) => [questionId, stripTransientAnswerData(answer)])) as Record<
    string,
    AnswerState
  >;
}

function buildTemporaryScorePreview(
  question: AssessmentQuestion,
  answer: AnswerState,
  testResults: TestResultsOutput | null,
): TemporaryScorePreview | null {
  const updatedAt = new Date().toISOString();

  if (question.engine === "code") {
    if (!testResults?.total) {
      return {
        label: "Temporary score preview",
        score: "Unavailable",
        detail: "Structured test results were not returned by the runner.",
        note: "This preview is local-only and is not saved.",
        updatedAt,
      };
    }

    const percent = Math.round((testResults.passed / testResults.total) * 100);
    const visibleOnly = testResults.test_results.every((test) => test.displayStatus === "visible");
    if (visibleOnly) {
      return {
        label: "Temporary score preview",
        score: "Preview only",
        detail: `${testResults.total} visible case(s) loaded`,
        note: "Visible cases do not produce a final score. This preview is local-only and is not saved.",
        updatedAt,
      };
    }

    return {
      label: "Temporary score preview",
      score: `${percent}%`,
      detail: `${testResults.passed}/${testResults.total} tests passed`,
      note: "Computed from structured runner output. Local preview is not saved.",
      updatedAt,
    };
  }

  if (question.engine === "mcq") {
    const correctOptions = question.correct_options || [];
    if (!correctOptions.length) {
      return {
        label: "Temporary score preview",
        score: "Unavailable",
        detail: "No answer key is configured for this MCQ.",
        note: "This preview is local-only and is not saved.",
        updatedAt,
      };
    }

    const isExactMatch = sameStringSet(answer.selectedOptions, correctOptions);
    return {
      label: "Temporary score preview",
      score: isExactMatch ? "100%" : "0%",
      detail: `${answer.selectedOptions.length}/${correctOptions.length} option(s) matched`,
      note: "Computed locally from the MCQ answer key. Local preview is not saved.",
      updatedAt,
    };
  }

  return {
    label: "Temporary score preview",
    score: "Not computed",
    detail: "SQL scoring is not stored in the temporary window.",
    note: "This panel only shows the live query result for local testing.",
    updatedAt,
  };
}

function buildDsaCalculationOutput(
  question: AssessmentQuestion,
  answer: AnswerState,
  testResults: TestResultsOutput | null,
  backendEvaluation: Record<string, unknown> | null = null,
): DsaCalculationOutput | null {
  if (question.section !== "DSA" || question.engine !== "code") return null;

  const code = answer.value || "";
  const expectedApproach = stringList(question.expected_approach);
  const expectedCode = stringList(question.expected_code);
  const openCases = question.open_test_cases?.length
    ? question.open_test_cases
    : question.test_cases?.slice(0, 5) || [];
  const hiddenCases = question.hidden_test_cases?.length
    ? question.hidden_test_cases
    : question.test_cases?.slice(openCases.length) || [];
  const results = answer.testResults?.test_results || testResults?.test_results || [];
  const backendOutput = backendEvaluation || {};
  const openResultCount = Math.min(openCases.length, results.length);
  const hiddenResultCount = Math.max(0, Math.min(hiddenCases.length, results.length - openResultCount));
  const openPassed = countPassed(results.slice(0, openResultCount));
  const hiddenPassed = countPassed(results.slice(openResultCount, openResultCount + hiddenResultCount));
  const openTotal = openCases.length;
  const hiddenTotal = hiddenCases.length;
  const openTestCaseScore = typeof backendOutput.open_test_case_score === "number"
    ? backendOutput.open_test_case_score
    : scoreRatio(openPassed, openTotal);
  const hiddenTestCaseScore = typeof backendOutput.hidden_test_case_score === "number"
    ? backendOutput.hidden_test_case_score
    : hiddenTotal > 0
      ? scoreRatio(hiddenPassed, hiddenTotal)
      : "Not available";
  const correctnessScore = typeof backendOutput.correctness_score === "number"
    ? backendOutput.correctness_score
    : openTestCaseScore;
  const expectedCodeBreakdown = {
    score: typeof backendOutput.expected_code_score === "number"
      ? backendOutput.expected_code_score
      : expectedCodeScore(expectedCode, code).score,
    matched: Array.isArray(backendOutput.matched_expected_code)
      ? backendOutput.matched_expected_code.map((item) => String(item))
      : expectedCodeScore(expectedCode, code).matched,
    missing: Array.isArray(backendOutput.missing_expected_code)
      ? backendOutput.missing_expected_code.map((item) => String(item))
      : expectedCodeScore(expectedCode, code).missing,
  };
  const approach = typeof backendOutput.approach_score === "number"
    ? backendOutput.approach_score
    : approachScore(expectedApproach, code, correctnessScore);
  const expectedTimeComplexity = String(
    backendOutput.expected_time_complexity || question.expected_time_complexity || "Not available",
  );
  const expectedSpaceComplexity = String(
    backendOutput.expected_space_complexity || question.expected_space_complexity || "Not available",
  );
  const expectedTimeComplexityRank = typeof backendOutput.expected_time_complexity_rank === "number"
    ? backendOutput.expected_time_complexity_rank
    : "Not available";
  const expectedSpaceComplexityRank = typeof backendOutput.expected_space_complexity_rank === "number"
    ? backendOutput.expected_space_complexity_rank
    : "Not available";
  const expectedTimeComplexityLabel = String(
    backendOutput.expected_time_complexity_label || (expectedTimeComplexityRank !== "Not available" ? `Rank ${expectedTimeComplexityRank}` : "AI evaluation pending"),
  );
  const expectedSpaceComplexityLabel = String(
    backendOutput.expected_space_complexity_label || (expectedSpaceComplexityRank !== "Not available" ? `Rank ${expectedSpaceComplexityRank}` : "AI evaluation pending"),
  );
  const studentTimeComplexityRank = typeof backendOutput.student_time_complexity_rank === "number"
    ? backendOutput.student_time_complexity_rank
    : "Not available";
  const studentSpaceComplexityRank = typeof backendOutput.student_space_complexity_rank === "number"
    ? backendOutput.student_space_complexity_rank
    : "Not available";
  const studentTimeComplexityLabel = String(
    backendOutput.student_time_complexity_label || (studentTimeComplexityRank !== "Not available" ? `Rank ${studentTimeComplexityRank}` : "AI evaluation pending"),
  );
  const studentSpaceComplexityLabel = String(
    backendOutput.student_space_complexity_label || (studentSpaceComplexityRank !== "Not available" ? `Rank ${studentSpaceComplexityRank}` : "AI evaluation pending"),
  );
  const timeComplexityRankGap =
    typeof studentTimeComplexityRank === "number"
      ? (typeof backendOutput.time_complexity_rank_gap === "number"
          ? backendOutput.time_complexity_rank_gap
          : typeof expectedTimeComplexityRank === "number"
            ? studentTimeComplexityRank - expectedTimeComplexityRank
            : "Not available")
      : "Not available";
  const spaceComplexityRankGap =
    typeof studentSpaceComplexityRank === "number"
      ? (typeof backendOutput.space_complexity_rank_gap === "number"
          ? backendOutput.space_complexity_rank_gap
          : typeof expectedSpaceComplexityRank === "number"
            ? studentSpaceComplexityRank - expectedSpaceComplexityRank
            : "Not available")
      : "Not available";
  const timeComplexityScore =
    typeof backendOutput.time_complexity_score === "number"
      ? backendOutput.time_complexity_score
      : "Not available";
  const spaceComplexityScore =
    typeof backendOutput.space_complexity_score === "number"
      ? backendOutput.space_complexity_score
      : "Not available";
  const edgeCaseCandidates = results.filter((test) =>
    /(edge|boundary|empty|duplicate|null|zero|single|large|cycle|self|same)/i.test(
      `${test.purpose} ${test.input} ${test.expected}`,
    ),
  ) || [];
  const edgeCasePassed = edgeCaseCandidates.filter((test) => test.passed).length;
  const edgeCaseScore = edgeCaseCandidates.length
    ? scoreRatio(edgeCasePassed, edgeCaseCandidates.length)
    : "Not available";
  const scoreParts = [
    correctnessScore,
    expectedCodeBreakdown.score,
    typeof timeComplexityScore === "number" ? timeComplexityScore : null,
    typeof spaceComplexityScore === "number" ? spaceComplexityScore : null,
    typeof edgeCaseScore === "number" ? edgeCaseScore : null,
  ].filter((value): value is number => typeof value === "number");
  const overallQuestionScore = scoreParts.length
    ? Math.round(scoreParts.reduce((sum, value) => sum + value, 0) / scoreParts.length)
    : 0;

  return {
    score: `${overallQuestionScore}%`,
    correctnessScore,
    openTestCaseScore,
    hiddenTestCaseScore,
    expectedCodeScore: expectedCodeBreakdown.score,
    approachScore: approach,
    timeComplexityScore,
    spaceComplexityScore,
    edgeCaseScore,
    overallQuestionScore,
    passed: openPassed + hiddenPassed,
    total: openResultCount + hiddenResultCount,
    openTestsPassed: `${openPassed} / ${openTotal}`,
    hiddenTestsPassed: hiddenTotal > 0 ? `${hiddenPassed} / ${hiddenTotal}` : "Not available",
    totalTestsPassed: `${openPassed + hiddenPassed} / ${openTotal + hiddenTotal}`,
    matchedExpectedCode: expectedCodeBreakdown.matched,
    missingExpectedCode: expectedCodeBreakdown.missing,
    expectedTimeComplexity,
    expectedTimeComplexityRank,
    expectedTimeComplexityLabel,
    studentTimeComplexityRank,
    studentTimeComplexityLabel,
    timeComplexityRankGap,
    expectedSpaceComplexity,
    expectedSpaceComplexityRank,
    expectedSpaceComplexityLabel,
    studentSpaceComplexityRank,
    studentSpaceComplexityLabel,
    spaceComplexityRankGap,
    expectedApproach,
    expectedCode,
    failedCaseAnalysis: edgeCaseCandidates.filter((test) => !test.passed).map((test) => test.purpose),
    missedEdgeCases: edgeCaseCandidates.filter((test) => !test.passed).map((test) => test.purpose),
    note:
      openTotal + hiddenTotal > 0
        ? "Calculated locally from structured test output. This is not persisted."
        : "No structured test output returned yet.",
    updatedAt: new Date().toISOString(),
  };
}

function formatTime(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function TimerBadge({
  seconds,
  hydrated,
  label = "Time left",
}: {
  seconds: number;
  hydrated: boolean;
  label?: string;
}) {
  if (!hydrated) {
    return (
      <div className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-slate-950 px-3 text-sm font-semibold text-white">
        <Clock size={17} />
        <span className="hidden sm:inline">{label}</span>
        --:--:--
      </div>
    );
  }

  return (
    <div className={`inline-flex h-10 items-center gap-2 rounded-[8px] px-3 text-sm font-semibold ${seconds < 600 ? "bg-red-50 text-red-800" : "bg-slate-950 text-white"}`}>
      <Clock size={17} />
      <span className="hidden sm:inline">{label}</span>
      {formatTime(seconds)}
    </div>
  );
}

function sectionIcon(section: AssessmentSectionId) {
  if (section === "DSA") return Code2;
  if (section === "SQL") return Database;
  if (section === "OOPs") return BookOpen;
  return FileQuestion;
}

function statusClass(status: AnswerState["status"], marked: boolean) {
  if (marked) return "border-amber-300 bg-amber-50 text-amber-800";
  if (status === "submitted") return "border-emerald-300 bg-emerald-50 text-emerald-800";
  if (status === "ran") return "border-sky-300 bg-sky-50 text-sky-800";
  if (status === "saved") return "border-slate-300 bg-slate-50 text-slate-700";
  return "border-slate-200 bg-white text-slate-500";
}

function createInitialAnswers(questions: AssessmentQuestion[]) {
  return Object.fromEntries(questions.map((question) => [question.id, initialAnswer(question)]));
}

function assessmentStorageScope(assessmentBank: AssessmentBank, assessmentInstanceId?: string) {
  return assessmentInstanceId || assessmentBank.assessment.id;
}

function storageKeyForBank(assessmentBank: AssessmentBank, assessmentInstanceId?: string, studentId?: string) {
  const assessmentScope = assessmentStorageScope(assessmentBank, assessmentInstanceId);
  return `joraiq-assessment:${studentId || "anonymous"}:${assessmentScope}`;
}

function sectionDurations(assessmentBank: AssessmentBank) {
  return Object.fromEntries(
    sectionOrder.map((section) => {
      const configured = assessmentBank.assessment.sections.find((item) => item.name === section)?.duration_minutes;
      return [section, configured && configured > 0 ? configured : defaultSectionDurations[section]];
    }),
  ) as Record<AssessmentSectionId, number>;
}

function sectionTimingForElapsed(assessmentBank: AssessmentBank, elapsedSeconds: number) {
  const durations = sectionDurations(assessmentBank);
  let elapsedBeforeSection = 0;

  for (const section of sectionOrder) {
    const durationSeconds = durations[section] * 60;
    const sectionEnd = elapsedBeforeSection + durationSeconds;
    if (elapsedSeconds < sectionEnd) {
      return {
        activeSection: section,
        sectionRemainingSeconds: Math.max(0, sectionEnd - elapsedSeconds),
        totalRemainingSeconds: Math.max(
          0,
          sectionOrder.reduce((sum, item) => sum + durations[item] * 60, 0) - elapsedSeconds,
        ),
      };
    }
    elapsedBeforeSection = sectionEnd;
  }

  return {
    activeSection: sectionOrder[sectionOrder.length - 1],
    sectionRemainingSeconds: 0,
    totalRemainingSeconds: 0,
  };
}

function firstQuestionInSection(questions: AssessmentQuestion[], section: AssessmentSectionId) {
  return questions.find((question) => question.section === section)?.id || questions[0]?.id || "";
}

function publicEnvEnabled(value: string | undefined) {
  if (value === undefined) return null;
  return !["0", "false", "off", "no"].includes(value.trim().toLowerCase());
}

function publicEnvNumber(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function defaultCameraPosition(): CameraPosition {
  if (typeof window === "undefined") return { x: 16, y: 16 };
  return {
    x: 16,
    y: Math.max(16, window.innerHeight - 176),
  };
}

function clampCameraPosition(position: CameraPosition): CameraPosition {
  if (typeof window === "undefined") return position;
  return {
    x: Math.max(8, Math.min(position.x, window.innerWidth - 190)),
    y: Math.max(8, Math.min(position.y, window.innerHeight - 150)),
  };
}

function loadInitialSnapshot(assessmentBank: AssessmentBank) {
  const questions = assessmentBank.questions;
  const initialTiming = sectionTimingForElapsed(assessmentBank, 0);
  return {
    activeQuestionId: firstQuestionInSection(questions, initialTiming.activeSection),
    answers: createInitialAnswers(questions),
    activeSection: initialTiming.activeSection,
    sectionRemainingSeconds: initialTiming.sectionRemainingSeconds,
    remainingSeconds: initialTiming.totalRemainingSeconds,
    tabEvents: 0,
    cameraEvents: 0,
    persistedAttemptId: null as string | null,
  };
}

function loadSavedSnapshot(assessmentBank: AssessmentBank, assessmentInstanceId?: string, studentId?: string) {
  const questions = assessmentBank.questions;
  const storageKey = storageKeyForBank(assessmentBank, assessmentInstanceId, studentId);
  const attemptIdKey = `${storageKey}:attemptId`;
  const fallback = loadInitialSnapshot(assessmentBank);
  if (typeof window === "undefined") return fallback;

  // Guard: never load an anonymous-scoped key if a real studentId is known
  if (studentId && storageKey.includes(":anonymous:")) {
    window.localStorage.removeItem(storageKey);
    window.localStorage.removeItem(`${storageKey}:startedAt`);
    return fallback;
  }

  const saved = window.localStorage.getItem(storageKey);
  if (!saved) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(saved) as {
      answers?: Record<string, AnswerState>;
      activeQuestionId?: string;
      activeSection?: AssessmentSectionId;
      startedAt?: string;
      tabEvents?: number;
      cameraEvents?: number;
    };
    const startedAt = parsed.startedAt || window.localStorage.getItem(`${storageKey}:startedAt`);
    const elapsed = startedAt ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000) : 0;
    const timing = sectionTimingForElapsed(assessmentBank, elapsed);
    const persistedAttemptId = window.localStorage.getItem(attemptIdKey);
    const savedActiveQuestion = parsed.activeQuestionId
      ? questions.find((question) => question.id === parsed.activeQuestionId)
      : null;
    const activeSection = savedActiveQuestion?.section || parsed.activeSection || timing.activeSection;
    return {
      activeQuestionId: savedActiveQuestion?.id || firstQuestionInSection(questions, activeSection),
      answers: sanitizeAnswersForStorage({ ...fallback.answers, ...(parsed.answers || {}) }),
      activeSection,
      sectionRemainingSeconds: timing.sectionRemainingSeconds,
      remainingSeconds: timing.totalRemainingSeconds,
      tabEvents: parsed.tabEvents || 0,
      cameraEvents: parsed.cameraEvents || 0,
      persistedAttemptId,
    };
  } catch {
    window.localStorage.removeItem(storageKey);
    window.localStorage.removeItem(attemptIdKey);
    return fallback;
  }
}

export function AssessmentShell({
  assessmentBank,
  assessmentInstanceId,
  studentId,
}: {
  assessmentBank: AssessmentBank;
  assessmentInstanceId?: string;
  studentId?: string;
}) {
  const router = useRouter();
  const authClient = useMemo(() => supabaseBrowser(), []);
  const questions = assessmentBank.questions;
  const storageKey = storageKeyForBank(assessmentBank, assessmentInstanceId, studentId);
  const legacyStorageKey = `joraiq-assessment:${assessmentStorageScope(assessmentBank, assessmentInstanceId)}`;

  const [initialSnapshot] = useState(() => loadInitialSnapshot(assessmentBank));
  const initialTabEvents = localProctoringDisabled ? 0 : initialSnapshot.tabEvents;
  const initialCameraEvents = localProctoringDisabled ? 0 : initialSnapshot.cameraEvents;
  const [activeQuestionId, setActiveQuestionId] = useState(initialSnapshot.activeQuestionId);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>(initialSnapshot.answers);
  const [activeSection, setActiveSection] = useState<AssessmentSectionId>(initialSnapshot.activeSection);
  const [sectionRemainingSeconds, setSectionRemainingSeconds] = useState(initialSnapshot.sectionRemainingSeconds);
  const [remainingSeconds, setRemainingSeconds] = useState(initialSnapshot.remainingSeconds);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [isQuestionPanelPinned, setIsQuestionPanelPinned] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("answer");
  const [tabEvents, setTabEvents] = useState(initialTabEvents);
  const [cameraEvents, setCameraEvents] = useState(initialCameraEvents);
  const [persistedAttemptId, setPersistedAttemptId] = useState<string | null>(initialSnapshot.persistedAttemptId);
  const [persistedDsaEvaluationByQuestion, setPersistedDsaEvaluationByQuestion] = useState<Record<string, Record<string, unknown> | null>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [integrityViolation, setIntegrityViolation] = useState<IntegrityViolation | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [isIntegrityLocked, setIsIntegrityLocked] = useState(false);
  const [cameraPosition, setCameraPosition] = useState<CameraPosition>(() => {
    if (typeof window === "undefined") return defaultCameraPosition();

    const rawPosition = window.localStorage.getItem(`assessment:${assessmentBank.assessment.id}:cameraPosition`);
    if (!rawPosition) return defaultCameraPosition();

    try {
      const parsed = JSON.parse(rawPosition) as Partial<CameraPosition>;
      return clampCameraPosition({
        x: Number(parsed.x || 16),
        y: Number(parsed.y || 16),
      });
    } catch {
      window.localStorage.removeItem(`assessment:${assessmentBank.assessment.id}:cameraPosition`);
      return defaultCameraPosition();
    }
  });
  const [sqlResult, setSqlResult] = useState<SqlRunResponse | null>(null);
  const [testResults, setTestResults] = useState<TestResultsOutput | null>(null);
  const [temporaryScorePreviewByQuestion, setTemporaryScorePreviewByQuestion] = useState<Record<string, TemporaryScorePreview | null>>({});
  const [animatingTestIndex, setAnimatingTestIndex] = useState<number>(-1);
  const resultsRef = useRef<HTMLDivElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const autoSubmitStartedRef = useRef(false);
  const pendingTabWarningRef = useRef<number | null>(null);
  const cameraDragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);

  const activeIndex = questions.findIndex((question) => question.id === activeQuestionId);
  const activeQuestion = questions[Math.max(0, activeIndex)];
  const activeAnswer = answers[activeQuestion.id] || initialAnswer(activeQuestion);
  const activeTemporaryScorePreview = temporaryScorePreviewByQuestion[activeQuestion.id];
  const activeDsaCalculationOutput = buildDsaCalculationOutput(
    activeQuestion,
    activeAnswer,
    testResults,
    persistedDsaEvaluationByQuestion[activeQuestion.id] || null,
  );
  const navigationType = useMemo(() => {
    if (typeof window === "undefined" || typeof performance === "undefined") return "navigate";
    const entries = performance.getEntriesByType?.("navigation") || [];
    const entry = entries[0] as PerformanceNavigationTiming | undefined;
    if (entry?.type) return entry.type;

    const legacyType = (performance as Performance & { navigation?: { type?: number } }).navigation?.type;
    if (legacyType === 1) return "reload";
    return "navigate";
  }, []);
  const tabSecurity = useMemo(() => {
    if (localProctoringDisabled) {
      return {
        enabled: false,
        maxEvents: 1,
        autoSubmitOnMax: false,
      };
    }

    const configured = assessmentBank.assessment.security;
    const envEnabled = publicEnvEnabled(process.env.NEXT_PUBLIC_ASSESSMENT_TAB_SECURITY_ENABLED);
    const envMaxEvents = publicEnvNumber(process.env.NEXT_PUBLIC_ASSESSMENT_TAB_SECURITY_MAX_EVENTS);
    return {
      enabled: envEnabled ?? configured?.tab_switch_protection_enabled ?? true,
      maxEvents: envMaxEvents ?? configured?.max_tab_switch_events ?? 2,
      autoSubmitOnMax: configured?.auto_submit_on_max_events ?? true,
    };
  }, [assessmentBank.assessment.security]);
  const cameraSecurity = useMemo(() => {
    if (localProctoringDisabled) {
      return {
        enabled: false,
        maxEvents: 1,
        autoSubmitOnMax: false,
      };
    }

    const configured = assessmentBank.assessment.security;
    const envEnabled = publicEnvEnabled(process.env.NEXT_PUBLIC_ASSESSMENT_CAMERA_PROCTORING_ENABLED);
    const envMaxEvents = publicEnvNumber(process.env.NEXT_PUBLIC_ASSESSMENT_CAMERA_MAX_EVENTS);
    return {
      enabled: envEnabled ?? configured?.camera_proctoring_enabled ?? false,
      maxEvents: envMaxEvents ?? configured?.max_camera_events ?? 1,
      autoSubmitOnMax: configured?.auto_submit_on_camera_events ?? true,
    };
  }, [assessmentBank.assessment.security]);
  const canRunAssessment = !cameraSecurity.enabled || Boolean(cameraStream);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      localStorage.removeItem(legacyStorageKey);
      localStorage.removeItem(`${legacyStorageKey}:startedAt`);
      const savedSnapshot = loadSavedSnapshot(assessmentBank, assessmentInstanceId, studentId);
      setActiveQuestionId(savedSnapshot.activeQuestionId);
      setAnswers(savedSnapshot.answers);
      setActiveSection(savedSnapshot.activeSection);
      setSectionRemainingSeconds(savedSnapshot.sectionRemainingSeconds);
      setRemainingSeconds(savedSnapshot.remainingSeconds);
      setTabEvents(localProctoringDisabled ? 0 : savedSnapshot.tabEvents);
      setCameraEvents(localProctoringDisabled ? 0 : savedSnapshot.cameraEvents);
      setPersistedAttemptId(savedSnapshot.persistedAttemptId || null);
      setHasHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [assessmentBank, assessmentInstanceId, legacyStorageKey, studentId]);

  const questionsBySection = useMemo(
    () =>
      sectionOrder.map((section) => ({
        section,
        questions: questions.filter((question) => question.section === section),
        meta: assessmentBank.assessment.sections.find((item) => item.name === section),
      })),
    [assessmentBank.assessment.sections, questions],
  );

  const sectionStatuses = useMemo(
    () =>
      Object.fromEntries(
        sectionOrder.map((section) => [
          section,
          section === activeSection
            ? "active"
            : questions
                .filter((question) => question.section === section)
                .every((question) => answers[question.id]?.status === "submitted")
              ? "completed"
              : "unlocked",
        ]),
      ) as Record<AssessmentSectionId, SectionStatus>,
    [activeSection, answers, questions],
  );

  useEffect(() => {
    if (!hasHydrated || !canRunAssessment) return;

    if (!localStorage.getItem(`${storageKey}:startedAt`)) {
      localStorage.setItem(`${storageKey}:startedAt`, new Date().toISOString());
    }

    const interval = window.setInterval(() => {
      const startedAt = localStorage.getItem(`${storageKey}:startedAt`);
      const elapsed = startedAt ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000) : 0;
      const timing = sectionTimingForElapsed(assessmentBank, elapsed);

      setSectionRemainingSeconds(timing.sectionRemainingSeconds);
      setRemainingSeconds(timing.totalRemainingSeconds);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [assessmentBank, canRunAssessment, hasHydrated, questions, storageKey]);

  useEffect(() => {
    if (!hasHydrated || !canRunAssessment) return;

    const interval = window.setInterval(() => {
      const existing = localStorage.getItem(storageKey);
      let startedAt = localStorage.getItem(`${storageKey}:startedAt`);
      if (!startedAt) {
        startedAt = new Date().toISOString();
        localStorage.setItem(`${storageKey}:startedAt`, startedAt);
      }

      localStorage.setItem(
        storageKey,
        JSON.stringify({
          ...(existing ? JSON.parse(existing) : {}),
          answers: sanitizeAnswersForStorage(answers),
          activeQuestionId,
          startedAt,
          activeSection,
          tabEvents,
          cameraEvents,
          savedAt: new Date().toISOString(),
        }),
      );
      setLastSavedAt(new Date());
    }, 6000);

    return () => window.clearInterval(interval);
  }, [activeQuestionId, activeSection, answers, cameraEvents, canRunAssessment, hasHydrated, storageKey, tabEvents]);

  const updateActiveAnswer = useCallback((patch: Partial<AnswerState>) => {
    setAnswers((current) => ({
      ...current,
      [activeQuestion.id]: {
        ...(current[activeQuestion.id] || initialAnswer(activeQuestion)),
        ...patch,
        status: patch.status || "saved",
      },
    }));
  }, [activeQuestion]);

  const handleValueChange = useCallback(
    (value: string) => updateActiveAnswer({ value }),
    [updateActiveAnswer],
  );

  const handleMcqChange = useCallback(
    (selectedOptions: string[]) => updateActiveAnswer({ selectedOptions }),
    [updateActiveAnswer],
  );

  const disqualifyAssessment = useCallback((
    source: IntegrityViolation["source"],
    eventCount: number,
    message: string,
  ) => {
    if (isFinalizing || autoSubmitStartedRef.current || isIntegrityLocked) return;

    cameraStream?.getTracks().forEach((track) => track.stop());
    setIntegrityViolation({ source, eventCount, message });
    setIsIntegrityLocked(true);
  }, [cameraStream, isFinalizing, isIntegrityLocked]);

  const buildIntegrityMessage = useCallback((source: IntegrityViolation["source"], count: number) => {
    if (source === "tab_switch") {
      return count === 1
        ? "Switching tabs or windows was detected. Do not do it again or you will be disqualified."
        : `Tab/window switch ${count} detected. The assessment has been disqualified.`;
    }

    return count === 1
      ? "Camera interruption was detected. Do not do it again or you will be disqualified."
      : `Camera warning ${count} detected. The assessment has been disqualified.`;
  }, []);

  const recordCameraEvent = useCallback((message: string) => {
    if (!cameraSecurity.enabled || isFinalizing || autoSubmitStartedRef.current) return;

    let nextCount = cameraEvents + 1;
    setCameraEvents((count) => {
      nextCount = count + 1;
      return nextCount;
    });

    const reachedLimit = nextCount >= cameraSecurity.maxEvents;
    window.alert(
      reachedLimit
        ? `Camera warning ${nextCount}/${cameraSecurity.maxEvents}: ${message}. The assessment has been disqualified.`
        : `Camera warning ${nextCount}/${cameraSecurity.maxEvents}: ${message}`,
    );
    if (reachedLimit && cameraSecurity.autoSubmitOnMax) {
      void disqualifyAssessment("camera", nextCount, `Camera warning ${nextCount}/${cameraSecurity.maxEvents}: ${message}`);
    }
  }, [cameraEvents, cameraSecurity.autoSubmitOnMax, cameraSecurity.enabled, cameraSecurity.maxEvents, disqualifyAssessment, isFinalizing]);

  const requestCameraAccess = useCallback(async () => {
    if (!cameraSecurity.enabled) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not supported in this browser.");
      return;
    }

    setIsRequestingCamera(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      if (!localStorage.getItem(`${storageKey}:startedAt`)) {
        localStorage.setItem(`${storageKey}:startedAt`, new Date().toISOString());
      }
      setCameraStream(stream);
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "Camera permission was not granted.");
    } finally {
      setIsRequestingCamera(false);
    }
  }, [cameraSecurity.enabled, storageKey]);

  const cameraPositionKey = `${storageKey}:cameraPosition`;

  useEffect(() => {
    if (!cameraSecurity.enabled) return;
    localStorage.setItem(cameraPositionKey, JSON.stringify(cameraPosition));
  }, [cameraPosition, cameraPositionKey, cameraSecurity.enabled]);

  function startCameraDrag(event: PointerEvent<HTMLDivElement>) {
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    cameraDragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - cameraPosition.x,
      offsetY: event.clientY - cameraPosition.y,
    };
  }

  function moveCameraDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = cameraDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setCameraPosition(clampCameraPosition({
      x: event.clientX - drag.offsetX,
      y: event.clientY - drag.offsetY,
    }));
  }

  function stopCameraDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = cameraDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    cameraDragRef.current = null;
  }

  function scrollToResults() {
    window.requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function changeQuestion(questionId: string) {
    const targetQuestion = questions.find((question) => question.id === questionId);
    if (!targetQuestion) return;

    setActiveSection(targetQuestion.section);
    setActiveQuestionId(questionId);
    setActiveTab("answer");
    setNavOpen(false);
    setSqlResult(null);
    setTestResults((current) => answers[questionId]?.testResults || current);
    setAnimatingTestIndex(-1);
    setAnswers((current) => ({
      ...current,
      [questionId]: {
        ...(current[questionId] || initialAnswer(targetQuestion)),
        status: current[questionId]?.status === "unvisited" ? "saved" : current[questionId]?.status || "saved",
      },
    }));
  }

  function changeLanguage(language: string) {
    updateActiveAnswer({
      language,
      value: activeQuestion.starter_code?.[language] || activeAnswer.value,
    });
  }

  async function persistDsaSubmission(
    nextAnswer: AnswerState,
    structuredTestResults: TestResultsOutput | null,
  ) {
    if (activeQuestion.section !== "DSA" || activeQuestion.engine !== "code") {
      return;
    }

    const calculationOutput = buildDsaCalculationOutput(
      activeQuestion,
      nextAnswer,
      structuredTestResults,
    );
    if (!calculationOutput) return;

    const {
      data: { session },
    } = await authClient.auth.getSession();
    const response = await fetch("/api/assessment/dsa/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attempt_id: persistedAttemptId,
        assessment_id: assessmentInstanceId || assessmentBank.assessment.id,
        question_id: activeQuestion.id,
        started_at: localStorage.getItem(`${storageKey}:startedAt`) || new Date().toISOString(),
        submitted_at: new Date().toISOString(),
        duration_minutes: assessmentBank.assessment.duration_minutes,
        submission_mode: "manual",
        answer: {
          value: nextAnswer.value,
          language: nextAnswer.language,
          selectedOptions: nextAnswer.selectedOptions,
          marked: nextAnswer.marked,
          runs: nextAnswer.runs,
          submissions: nextAnswer.submissions,
          status: nextAnswer.status,
          testResults: structuredTestResults,
          test_results: structuredTestResults,
        },
        dsa_output: calculationOutput,
        test_results: structuredTestResults,
        access_token: session?.access_token || null,
      }),
    });
    const payload = (await response.json().catch(() => null)) as {
      attempt_id?: string;
      message?: string;
      evaluation?: { output?: Record<string, unknown> };
    } | null;

    if (!response.ok) {
      throw new Error(payload?.message || `DSA persistence failed with status ${response.status}`);
    }

    if (payload?.attempt_id) {
      setPersistedAttemptId(payload.attempt_id);
      localStorage.setItem(`${storageKey}:attemptId`, payload.attempt_id);
    }

    if (payload?.evaluation?.output) {
      setPersistedDsaEvaluationByQuestion((current) => ({
        ...current,
        [activeQuestion.id]: payload.evaluation?.output || null,
      }));
    }
  }

  async function executeCode(action: "run" | "submit") {
    if (isExecuting || isIntegrityLocked) return;

    setIsExecuting(true);
    const visibleFallback = visibleTestResultsForQuestion(activeQuestion);
    setTestResults(visibleFallback);
    setAnimatingTestIndex(-1);
    updateActiveAnswer({
      resultMessage: `${action === "run" ? "Running test cases" : "Submitting for evaluation"}...`,
    });
    setActiveTab("results");
    scrollToResults();

    try {
      const endpoint = `/api/code/${action}`;
      const requestBody = {
        attempt_id: "local-browser-attempt",
        question_id: activeQuestion.id,
        language: activeAnswer.language,
        source_code: activeAnswer.value,
        run_type: action,
      };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const payload = (await response.json().catch(() => null)) as CompilerResponse | null;

      if (!response.ok) {
        throw new Error(payload?.message || `Compiler request failed with status ${response.status}`);
      }

      const stdout = payload?.stdout || "";
      const stderr = payload?.stderr || "";
      const compileOutput = payload?.compile_output || "";
      const status = payload?.status?.description || "Completed";
      const time = payload?.time || "";
      const isError = payload?.status?.id === 6 || payload?.status?.id === 11;

      // Prefer backend-parsed structured test results, then fall back to stdout markers.
      let parsedTestResults: TestResultsOutput | null = payload?.test_results || null;
      const testStartMarker = "===TEST_RESULTS_START===";
      const testEndMarker = "===TEST_RESULTS_END===";
      const testStartIdx = stdout.indexOf(testStartMarker);
      const testEndIdx = stdout.indexOf(testEndMarker);

      if (!parsedTestResults && testStartIdx >= 0 && testEndIdx > testStartIdx) {
        const jsonStr = stdout.substring(testStartIdx + testStartMarker.length, testEndIdx).trim();
        try {
          parsedTestResults = JSON.parse(jsonStr) as TestResultsOutput;
        } catch {
          // Not valid JSON - fall through
        }
      }

      if (parsedTestResults && parsedTestResults.test_results?.length > 0) {
        // Animate test results one by one
        setTestResults(parsedTestResults);
        setTemporaryScorePreviewByQuestion((current) => ({
          ...current,
          [activeQuestion.id]: buildTemporaryScorePreview(activeQuestion, activeAnswer, parsedTestResults),
        }));
        const total = parsedTestResults.test_results.length;
        for (let i = 0; i < total; i++) {
          setAnimatingTestIndex(i);
          await new Promise((r) => setTimeout(r, 150));
        }
        setAnimatingTestIndex(-1);

        const resultMessage = "Code submission completed. Review the temporary score preview below.";
        const nextRuns = action === "run" ? activeAnswer.runs + 1 : activeAnswer.runs;
        const nextSubmissions = action === "submit" ? activeAnswer.submissions + 1 : activeAnswer.submissions;
        const nextAnswer: AnswerState = {
          ...activeAnswer,
          runs: nextRuns,
          submissions: nextSubmissions,
          status: action === "submit" ? "submitted" : "ran",
          resultMessage,
          testResults: parsedTestResults,
        };
        if (action === "submit") {
          try {
            await persistDsaSubmission(nextAnswer, parsedTestResults);
          } catch (persistError) {
            console.warn("Failed to persist DSA question output", persistError);
          }
        }
        updateActiveAnswer({
          ...nextAnswer,
        });
      } else {
        if (visibleFallback) {
          setTestResults(visibleFallback);
        }
        setTemporaryScorePreviewByQuestion((current) => ({
          ...current,
          [activeQuestion.id]: buildTemporaryScorePreview(activeQuestion, activeAnswer, visibleFallback),
        }));
        // No structured results - fall back to raw output display
        const resultLines = [
          isError ? `Compiler status: ${status}` : `Compiler status: ${status || "Completed"}`,
          time ? `Runtime: ${time}s` : null,
          compileOutput ? `Compile output:\n${compileOutput}` : null,
          stdout ? `Stdout:\n${stdout}` : null,
          stderr ? `Stderr:\n${stderr}` : null,
        ].filter(Boolean);

        const resultMessage = resultLines.join("\n\n") || "Compiler completed with no output.";
        const nextRuns = action === "run" ? activeAnswer.runs + 1 : activeAnswer.runs;
        const nextSubmissions = action === "submit" ? activeAnswer.submissions + 1 : activeAnswer.submissions;
        const nextAnswer: AnswerState = {
          ...activeAnswer,
          runs: nextRuns,
          submissions: nextSubmissions,
          status: action === "submit" ? "submitted" : "ran",
          resultMessage,
          testResults: parsedTestResults || visibleFallback,
        };
        if (action === "submit") {
          try {
            await persistDsaSubmission(nextAnswer, parsedTestResults || visibleFallback);
          } catch (persistError) {
            console.warn("Failed to persist DSA question output", persistError);
          }
        }
        updateActiveAnswer({
          ...nextAnswer,
        });
      }
    } catch (error) {
      const resultMessage = error instanceof Error ? error.message : "Compiler request failed.";
      setTemporaryScorePreviewByQuestion((current) => ({
        ...current,
        [activeQuestion.id]: buildTemporaryScorePreview(activeQuestion, activeAnswer, visibleFallback),
      }));
      updateActiveAnswer({
        runs: action === "run" ? activeAnswer.runs + 1 : activeAnswer.runs,
        submissions: action === "submit" ? activeAnswer.submissions + 1 : activeAnswer.submissions,
        status: action === "submit" ? "submitted" : "ran",
        resultMessage,
        testResults: visibleFallback,
      });
    } finally {
      setIsExecuting(false);
    }
  }

  async function executeSql(action: "run" | "submit") {
    if (isExecuting || isIntegrityLocked) return;

    setIsExecuting(true);
    updateActiveAnswer({
      resultMessage: `${action === "run" ? "Running SQL query" : "Submitting SQL query"}...`,
    });
    setSqlResult(null);
    setActiveTab("results");
    scrollToResults();

    try {
      const endpoint = `/api/sql/${action}`;
      const requestBody = {
        attempt_id: "local-browser-attempt",
        question_id: activeQuestion.id,
        query: activeAnswer.value,
        mode: action === "submit" ? "hidden" : "visible",
      };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const payload = (await response.json().catch(() => null)) as SqlRunResponse | null;

      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || `SQL request failed with status ${response.status}`);
      }

      setSqlResult(payload);
      setTemporaryScorePreviewByQuestion((current) => ({
        ...current,
        [activeQuestion.id]: buildTemporaryScorePreview(activeQuestion, activeAnswer, null),
      }));
      const resultMessage = payload?.error
        ? `SQL error:\n${payload.error}`
        : `SQL completed. Rows: ${payload?.row_count ?? 0}. Execution: ${payload?.execution_ms ?? 0} ms.`;
      updateActiveAnswer({
        runs: action === "run" ? activeAnswer.runs + 1 : activeAnswer.runs,
        submissions: action === "submit" ? activeAnswer.submissions + 1 : activeAnswer.submissions,
        status: action === "submit" ? "submitted" : "ran",
        sqlExecutionMs: typeof payload?.execution_ms === "number" ? payload.execution_ms : null,
        resultMessage,
      });
    } catch (error) {
      setSqlResult(null);
      setTemporaryScorePreviewByQuestion((current) => ({
        ...current,
        [activeQuestion.id]: buildTemporaryScorePreview(activeQuestion, activeAnswer, null),
      }));
      const resultMessage = error instanceof Error ? error.message : "SQL request failed.";
      updateActiveAnswer({
        runs: action === "run" ? activeAnswer.runs + 1 : activeAnswer.runs,
        submissions: action === "submit" ? activeAnswer.submissions + 1 : activeAnswer.submissions,
        status: action === "submit" ? "submitted" : "ran",
        resultMessage,
      });
    } finally {
      setIsExecuting(false);
    }
  }

  function runQuestion() {
    if (isExecuting || isIntegrityLocked) {
      updateActiveAnswer({
        resultMessage: isIntegrityLocked
          ? "This assessment has been disqualified because a cheating signal was detected."
          : "A compiler request is already running.",
      });
      setActiveTab("results");
      scrollToResults();
      return;
    }

    if (activeQuestion.engine === "code") {
      void executeCode("run");
      return;
    }

    if (activeQuestion.engine === "sql") {
      void executeSql("run");
      return;
    }

    updateActiveAnswer({
      runs: activeAnswer.runs + 1,
      status: "ran",
      resultMessage: "MCQ answer saved locally. Review the temporary score preview below.",
    });
    setTemporaryScorePreviewByQuestion((current) => ({
      ...current,
      [activeQuestion.id]: buildTemporaryScorePreview(activeQuestion, activeAnswer, null),
    }));
    setActiveTab("results");
    scrollToResults();
  }

  function submitQuestion() {
    if (isExecuting || isIntegrityLocked) {
      updateActiveAnswer({
        resultMessage: isIntegrityLocked
          ? "This assessment has been disqualified because a cheating signal was detected."
          : "A compiler request is already running.",
      });
      setActiveTab("results");
      scrollToResults();
      return;
    }

    if (activeQuestion.engine === "code") {
      void executeCode("submit");
      return;
    }

    if (activeQuestion.engine === "sql") {
      void executeSql("submit");
      return;
    }

    setTemporaryScorePreviewByQuestion((current) => ({
      ...current,
      [activeQuestion.id]: buildTemporaryScorePreview(activeQuestion, activeAnswer, null),
    }));
    const resultMessage = "Question submitted. Review the temporary score preview below.";
    updateActiveAnswer({
      submissions: activeAnswer.submissions + 1,
      status: "submitted",
      resultMessage,
    });

    const nextQuestion = questions[activeIndex + 1];
    if (nextQuestion) {
      changeQuestion(nextQuestion.id);
      return;
    }

    setActiveTab("results");
    scrollToResults();
  }

  const saveNow = useCallback(() => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        answers: sanitizeAnswersForStorage(answers),
        activeQuestionId,
        startedAt: localStorage.getItem(`${storageKey}:startedAt`) || new Date().toISOString(),
        activeSection,
        tabEvents,
        cameraEvents,
        savedAt: new Date().toISOString(),
      }),
    );
    setLastSavedAt(new Date());
  }, [activeQuestionId, activeSection, answers, cameraEvents, storageKey, tabEvents]);

  useEffect(() => {
    if (!hasHydrated) return;

    const attemptIdKey = `${storageKey}:attemptId`;
    if (persistedAttemptId) {
      localStorage.setItem(attemptIdKey, persistedAttemptId);
      return;
    }

    localStorage.removeItem(attemptIdKey);
  }, [hasHydrated, persistedAttemptId, storageKey]);

  const submitAssessment = useCallback(async (
    submissionMode: "manual" | "auto" = "manual",
    tabEventsOverride?: number,
    cameraEventsOverride?: number,
    integrityViolationOverride?: IntegrityViolation,
  ) => {
    if (isExecuting || isFinalizing) return;

    saveNow();
    setIsFinalizing(true);
    const integrityPayload = integrityViolationOverride || integrityViolation;
    const answersForSubmission = sanitizeAnswersForStorage(answers);

    try {
      const {
        data: { session },
      } = await authClient.auth.getSession();
      const submissionBody = {
        attempt_id: persistedAttemptId,
        assessment_id: assessmentInstanceId || assessmentBank.assessment.id,
        started_at: localStorage.getItem(`${storageKey}:startedAt`) || new Date().toISOString(),
        submitted_at: new Date().toISOString(),
        duration_minutes: assessmentBank.assessment.duration_minutes,
        tab_events: tabEventsOverride ?? tabEvents,
        camera_events: cameraEventsOverride ?? cameraEvents,
        submission_mode: submissionMode,
        integrity_status: integrityPayload ? "disqualified" : null,
        integrity_source: integrityPayload?.source || null,
        integrity_message: integrityPayload?.message || null,
        integrity_event_count: integrityPayload?.eventCount || null,
        access_token: session?.access_token || null,
        answers: answersForSubmission,
      };
      const response = await fetch("/api/assessment/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submissionBody),
      });
      const payload = (await response.json().catch(() => null)) as { attempt_id?: string; message?: string; statusCode?: number } | null;

      if (!response.ok) {
        if (response.status === 409) {
          localStorage.removeItem(storageKey);
          localStorage.removeItem(`${storageKey}:startedAt`);
          localStorage.removeItem(`${storageKey}:attemptId`);
          setPersistedAttemptId(null);
          router.replace("/assessment/report?mode=auto");
          router.refresh();
          return;
        }
        throw new Error(payload?.message || `Final submission failed with status ${response.status}`);
      }

      if (payload?.attempt_id) {
        setPersistedAttemptId(payload.attempt_id);
        localStorage.setItem(`${storageKey}:attemptId`, payload.attempt_id);
      }
      localStorage.removeItem(storageKey);
      localStorage.removeItem(`${storageKey}:startedAt`);
      const finalAttemptId = payload?.attempt_id || persistedAttemptId;
      localStorage.removeItem(`${storageKey}:attemptId`);
      setPersistedAttemptId(null);
      const reportPath = finalAttemptId
        ? `/assessment/report?attemptId=${encodeURIComponent(finalAttemptId)}&mode=${submissionMode}`
        : `/assessment/report?mode=${submissionMode}`;
      router.replace(reportPath);
      router.refresh();
    } catch (error) {
      if (integrityPayload) {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(`${storageKey}:startedAt`);
        localStorage.removeItem(`${storageKey}:attemptId`);
        setPersistedAttemptId(null);
        router.replace("/assessment/report?mode=auto");
        router.refresh();
        return;
      }
      
      // For non-integrity errors, show the error on the results panel
      updateActiveAnswer({
        resultMessage: error instanceof Error ? error.message : "Final assessment submission failed.",
      });
      setActiveTab("results");
    } finally {
      setIsFinalizing(false);
    }
  }, [
    answers,
    assessmentBank.assessment.duration_minutes,
    assessmentBank.assessment.id,
    assessmentInstanceId,
    authClient.auth,
    cameraEvents,
    isExecuting,
    isFinalizing,
    integrityViolation,
    router,
    saveNow,
    storageKey,
    tabEvents,
    updateActiveAnswer,
  ]);

  useEffect(() => {
    if (!integrityViolation || isExecuting || isFinalizing || autoSubmitStartedRef.current) return;

    autoSubmitStartedRef.current = true;
    void submitAssessment(
      "auto",
      integrityViolation.source === "tab_switch" ? integrityViolation.eventCount : undefined,
      integrityViolation.source === "camera" ? integrityViolation.eventCount : undefined,
      integrityViolation,
    );
  }, [integrityViolation, isExecuting, isFinalizing, submitAssessment]);

  useEffect(() => {
    if (!hasHydrated || !canRunAssessment || remainingSeconds > 0 || isExecuting || isFinalizing || autoSubmitStartedRef.current) return;

    autoSubmitStartedRef.current = true;
    void submitAssessment("auto");
  }, [canRunAssessment, hasHydrated, isExecuting, isFinalizing, remainingSeconds, submitAssessment]);

  useEffect(() => {
    if (!cameraVideoRef.current || !cameraStream) return;

    cameraVideoRef.current.srcObject = cameraStream;
  }, [cameraStream]);

  useEffect(() => {
    if (!cameraStream) return;

    const tracks = cameraStream.getVideoTracks();
    const onEnded = () => recordCameraEvent("Camera access stopped during the assessment.");
    const onMute = () => recordCameraEvent("Camera feed was interrupted during the assessment.");
    tracks.forEach((track) => {
      track.addEventListener("ended", onEnded);
      track.addEventListener("mute", onMute);
    });

    return () => {
      tracks.forEach((track) => {
        track.removeEventListener("ended", onEnded);
        track.removeEventListener("mute", onMute);
      });
    };
  }, [cameraStream, recordCameraEvent]);

  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraStream]);

  useEffect(() => {
    if (localProctoringDisabled || !hasHydrated || !canRunAssessment || !tabSecurity.enabled) return;

    function onVisibilityChange() {
      if (isFinalizing || autoSubmitStartedRef.current) return;

      if (document.hidden) {
        if (pendingTabWarningRef.current !== null) return;

        setTabEvents((count) => {
          const next = count + 1;
          pendingTabWarningRef.current = next;
          return next;
        });
        return;
      }

      const violationCount = pendingTabWarningRef.current;
      if (!violationCount) return;

      pendingTabWarningRef.current = null;
      const reachedLimit = violationCount >= tabSecurity.maxEvents;
      window.alert(
        reachedLimit
          ? `Warning ${violationCount}/${tabSecurity.maxEvents}: Switching tabs or windows has disqualified this attempt.`
          : `Warning ${violationCount}/${tabSecurity.maxEvents}: Switching tabs or windows was detected. Do not do it again or you will be disqualified.`,
      );

      if (reachedLimit && tabSecurity.autoSubmitOnMax) {
        disqualifyAssessment(
          "tab_switch",
          violationCount,
          buildIntegrityMessage("tab_switch", violationCount),
        );
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onVisibilityChange);
    };
  }, [buildIntegrityMessage, canRunAssessment, disqualifyAssessment, hasHydrated, isFinalizing, tabSecurity.autoSubmitOnMax, tabSecurity.enabled, tabSecurity.maxEvents]);

  useEffect(() => {
    if (localProctoringDisabled) return;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (isFinalizing || autoSubmitStartedRef.current || isIntegrityLocked) return;
      event.preventDefault();
      event.returnValue = "Reloading this assessment will disqualify your attempt.";
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isFinalizing, isIntegrityLocked]);

  useEffect(() => {
    if (localProctoringDisabled) return;
    if (!hasHydrated || navigationType !== "reload") return;
    if (isFinalizing || autoSubmitStartedRef.current || isIntegrityLocked) return;

    disqualifyAssessment(
      "tab_switch",
      1,
      "You reloaded the assessment page. Reloading the page disqualifies this attempt.",
    );
  }, [disqualifyAssessment, hasHydrated, isFinalizing, isIntegrityLocked, navigationType]);

  if (cameraSecurity.enabled && !cameraStream) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#f6f8f4] px-4 py-6 text-slate-950">
        <section className="w-full max-w-lg rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-[8px] bg-emerald-50 text-emerald-800">
            <Camera size={22} />
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-[-0.02em] text-slate-950">Camera access required</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Camera proctoring is active for this assessment. Turn on your camera to continue.
          </p>
          {cameraError ? (
            <div className="mt-4 flex gap-2 rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <CameraOff size={17} className="mt-0.5 shrink-0" />
              <p>{cameraError}</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void requestCameraAccess()}
            disabled={isRequestingCamera}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-[8px] bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
          >
            <Camera size={17} />
            {isRequestingCamera ? "Requesting camera..." : "Turn On Camera"}
          </button>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            The camera feed is monitored live in the browser. Video recording is going on.
          </p>
        </section>
      </main>
    );
  }

  const attempted = Object.values(answers).filter((answer) => answer.status !== "unvisited").length;
  const submitted = Object.values(answers).filter((answer) => answer.status === "submitted").length;
  const marked = Object.values(answers).filter((answer) => answer.marked).length;
  const isTimedOut = remainingSeconds === 0;
  const isSectionTimedOut = sectionRemainingSeconds === 0;
  const previousQuestion = activeIndex > 0 ? questions[activeIndex - 1] : null;
  const nextQuestion = activeIndex >= 0 && activeIndex < questions.length - 1
    ? questions[activeIndex + 1]
    : null;
  return (
    <main className="flex min-h-dvh flex-col bg-[radial-gradient(circle_at_top_left,#e7fff4_0,#f7faf8_30%,#eef3f0_100%)] text-slate-950">
      {cameraSecurity.enabled && cameraStream ? (
        <div
          className="fixed z-50 w-36 touch-none overflow-hidden rounded-[8px] border border-white/70 bg-slate-950 shadow-xl sm:w-44"
          style={{ left: cameraPosition.x, top: cameraPosition.y }}
          onPointerDown={startCameraDrag}
          onPointerMove={moveCameraDrag}
          onPointerUp={stopCameraDrag}
          onPointerCancel={stopCameraDrag}
          title="Drag camera preview"
        >
          <video ref={cameraVideoRef} autoPlay muted playsInline className="aspect-video w-full bg-slate-950 object-cover" />
          <div className="flex cursor-move items-center justify-between gap-2 bg-slate-950 px-2 py-1.5 text-[11px] font-semibold text-white">
            <span className="inline-flex items-center gap-1">
              <Camera size={12} />
              Camera on
            </span>
            <span>Drag · {cameraEvents}/{cameraSecurity.maxEvents}</span>
          </div>
        </div>
      ) : null}
      {integrityViolation ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/85 px-4 text-white">
          <section className="w-full max-w-xl rounded-[12px] border border-red-300 bg-slate-950 p-6 shadow-2xl">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-[10px] bg-red-500/15 text-red-300">
              <ShieldAlert size={22} />
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-white">Assessment disqualified</h2>
            <p className="mt-3 text-sm leading-6 text-slate-200">
              {integrityViolation.message}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              The session has been stopped. Switching tabs or losing camera access during the assessment disqualifies the attempt.
            </p>
            <p className="mt-4 rounded-[10px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
              Screen and camera activity are monitored during the assessment. Switching tabs or camera interruptions will stop the session and mark the attempt as disqualified.
            </p>
          </section>
        </div>
      ) : null}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur">
        <div className="flex min-h-16 items-center justify-between gap-3 px-3 sm:px-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-slate-300 lg:hidden"
              aria-label="Open question navigator"
            >
              <Menu size={18} />
            </button>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">JoraIQ Assessment Lab</p>
              <h1 className="text-sm font-semibold text-slate-950 sm:text-base">{assessmentBank.assessment.title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 md:block">
              Saved {lastSavedAt ? lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "pending"}
            </div>
            {/* <TimerBadge seconds={sectionRemainingSeconds} hydrated={hasHydrated} label={`${activeSection} left`} /> */}
            <div className="hidden sm:block">
              <TimerBadge seconds={remainingSeconds} hydrated={hasHydrated} label="Total" />
            </div>
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                aria-label="Logout"
                title="Logout"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </form>
            <button
              type="button"
              onClick={saveNow}
              disabled={isIntegrityLocked}
              className="hidden h-10 items-center gap-2 rounded-[8px] border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 sm:inline-flex"
            >
              <Save size={16} />
              Save
            </button>
            <button
              type="button"
              onClick={() => void submitAssessment("manual")}
              disabled={isExecuting || isFinalizing || isIntegrityLocked}
              className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-emerald-700 px-3 text-sm font-semibold text-white shadow-sm shadow-emerald-900/10 hover:bg-emerald-800 disabled:opacity-40"
            >
              <Send size={16} />
              <span className="hidden sm:inline">{isFinalizing ? "Submitting..." : "Submit Assessment"}</span>
            </button>
          </div>
        </div>

        <div className="grid gap-2 border-t border-slate-100 bg-slate-50/70 px-3 py-2 sm:grid-cols-4 sm:px-5">
          {questionsBySection.map(({ section, questions: sectionQuestions, meta }) => {
            const done = sectionQuestions.filter((question) => answers[question.id]?.status === "submitted").length;
            const status = sectionStatuses[section];
            const sectionDuration = meta?.duration_minutes || defaultSectionDurations[section];
            const Icon = sectionIcon(section);
            return (
              <div
                key={section}
                className={`relative overflow-hidden rounded-[10px] border px-3 py-2 text-xs transition ${
                  status === "active"
                    ? "border-emerald-300 bg-white shadow-sm ring-1 ring-emerald-100"
                    : status === "completed"
                      ? "border-slate-200 bg-white"
                      : "border-slate-200 bg-white"
                }`}
              >
                {status === "active" ? <div className="absolute inset-x-0 top-0 h-0.5 bg-emerald-600" /> : null}
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-semibold text-slate-800">
                    <Icon size={15} className={status === "active" ? "text-emerald-700" : "text-slate-500"} />
                    <span>{section}</span>
                    {status === "active" ? " - Active" : status === "completed" ? " - Completed" : " - Unlocked"}
                  </span>
                  <span className="text-slate-500">{done}/{sectionQuestions.length}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-emerald-700" style={{ width: `${(done / sectionQuestions.length) * 100}%` }} />
                </div>
                <p className="mt-1 text-slate-500">
                  {sectionDuration} min
                  {status === "active" ? ` - ${formatTime(sectionRemainingSeconds)} left` : ""}
                </p>
              </div>
            );
          })}
        </div>
      </header>

      <div className={`grid flex-1 ${isQuestionPanelPinned ? "lg:grid-cols-[300px_1fr]" : "lg:grid-cols-[64px_1fr]"}`}>
        <aside className="hidden border-r border-slate-200 bg-white lg:block">
          {isQuestionPanelPinned ? (
            <QuestionNavigator
              activeQuestionId={activeQuestion.id}
              assessmentBank={assessmentBank}
              answers={answers}
              attempted={attempted}
              marked={marked}
              submitted={submitted}
              activeSection={activeSection}
              sectionStatuses={sectionStatuses}
              disabled={isExecuting || isIntegrityLocked}
              pinned={isQuestionPanelPinned}
              onTogglePinned={() => setIsQuestionPanelPinned((value) => !value)}
              onSelect={changeQuestion}
            />
          ) : (
            <div className="flex h-full flex-col items-center gap-4 bg-white px-2 py-4">
              <button
                type="button"
                onClick={() => setIsQuestionPanelPinned(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-slate-200 bg-slate-50 text-slate-700 shadow-sm hover:bg-white"
                aria-label="Pin question panel"
                title="Pin question panel"
              >
                <PanelLeftOpen size={18} />
              </button>
              <div className="grid gap-2">
                {sectionOrder.map((section) => {
                  const Icon = sectionIcon(section);
                  const status = sectionStatuses[section];
                  const count = assessmentBank.questions.filter((question) => question.section === section).length;
                  return (
                    <button
                      key={section}
                      type="button"
                      onClick={() => setIsQuestionPanelPinned(true)}
                      disabled={isIntegrityLocked}
                      className={`relative inline-flex h-10 w-10 items-center justify-center rounded-[10px] border ${
                        status === "active"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-white text-slate-500"
                      } disabled:opacity-40`}
                      title={`${section} ${status}`}
                    >
                      <Icon size={17} />
                      <span className="absolute -right-1 -top-1 rounded-full bg-slate-950 px-1 text-[10px] font-semibold text-white">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-auto grid gap-2 text-center text-[10px] text-slate-500">
                <span className="rounded-[10px] bg-slate-50 px-2 py-2">
                  <strong className="block text-sm text-slate-950">{attempted}</strong>
                  Seen
                </span>
                <span className="rounded-[10px] bg-emerald-50 px-2 py-2 text-emerald-700">
                  <strong className="block text-sm text-emerald-800">{submitted}</strong>
                  Done
                </span>
              </div>
            </div>
          )}
        </aside>

        {navOpen ? (
          <div className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden">
            <aside className="h-full w-[86vw] max-w-sm overflow-auto bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 p-4">
                <h2 className="font-semibold">Questions</h2>
                <button type="button" onClick={() => setNavOpen(false)} className="rounded-[8px] p-2 hover:bg-slate-100" aria-label="Close question navigator">
                  <X size={18} />
                </button>
              </div>
              <QuestionNavigator
                activeQuestionId={activeQuestion.id}
                assessmentBank={assessmentBank}
                answers={answers}
                attempted={attempted}
                marked={marked}
                submitted={submitted}
                activeSection={activeSection}
                sectionStatuses={sectionStatuses}
                disabled={isExecuting || isIntegrityLocked}
                pinned
                onSelect={changeQuestion}
              />
            </aside>
          </div>
        ) : null}

        <section className="grid min-h-0 grid-rows-[auto_1fr_auto]">
          <div className="border-b border-slate-200 bg-white/95 px-3 py-3 shadow-sm sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-[8px] bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
                    {activeQuestion.section}
                  </span>
                  <span className="rounded-[8px] bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                    {activeQuestion.marks || 5} marks
                  </span>
                </div>
                {activeQuestion.section !== "MCQ" ? (
                  <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-slate-950">{activeQuestion.title}</h2>
                ) : null}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                {isTimedOut || isSectionTimedOut ? (
                  <span className="rounded-[8px] border border-red-200 bg-red-50 px-2 py-1 font-semibold text-red-800">
                    {isTimedOut ? "Assessment expired" : `${activeSection} time expired`}
                  </span>
                ) : null}
                <span className="rounded-[8px] border border-slate-200 px-2 py-1">Runs {activeAnswer.runs}</span>
                <span className="rounded-[8px] border border-slate-200 px-2 py-1">Submits {activeAnswer.submissions}</span>
                {/* <span className="rounded-[8px] border border-slate-200 px-2 py-1">Tab events {tabEvents}</span> */}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 lg:hidden">
              {(["problem", "answer", "results"] as ActiveTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-[8px] px-3 py-2 text-sm font-semibold capitalize ${
                    activeTab === tab ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="grid min-h-0 gap-3 overflow-hidden p-3 lg:grid-cols-[minmax(380px,0.92fr)_minmax(460px,1.25fr)]">
            <QuestionPrompt question={activeQuestion} visible={activeTab === "problem"} />
            <AnswerPanel
              question={activeQuestion}
              assessmentBank={assessmentBank}
              answer={activeAnswer}
              visible={activeTab === "answer"}
              onValueChange={handleValueChange}
              onLanguageChange={changeLanguage}
              onMcqChange={handleMcqChange}
            />
          </div>

          <div ref={resultsRef} className={`${activeTab === "results" ? "block" : "hidden"} scroll-mt-24 border-t border-slate-200 bg-slate-950 p-3 lg:block sm:p-4`}>
            <div className="grid gap-3">
              {testResults && activeQuestion.engine === "code" ? (
                <TestResultsPanel
                  testResults={testResults}
                  animatingIndex={animatingTestIndex}
                />
              ) : null}
              <div className="rounded-[10px] border border-slate-800 bg-slate-900 p-3 text-sm leading-6 text-slate-200">
                <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  <span>Compiler Output</span>
                  <span>{activeQuestion.engine.toUpperCase()}</span>
                </div>
                <pre className="whitespace-pre-wrap font-mono text-xs leading-6 text-slate-100">{activeAnswer.resultMessage}</pre>
              </div>
              {activeQuestion.engine === "sql" ? (
                <SqlResultGrid
                  columns={sqlResult?.columns?.length ? sqlResult.columns : ["status", "message"]}
                  rows={
                    sqlResult?.columns?.length
                      ? sqlResult.rows || []
                      : [{ status: sqlResult?.error ? "error" : "info", message: activeAnswer.resultMessage }]
                  }
                />
              ) : null}
              {process.env.NODE_ENV !== "production" && activeTemporaryScorePreview ? (
                <div className="rounded-[10px] border border-emerald-700/40 bg-emerald-950/20 p-3 text-sm leading-6 text-emerald-50">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">
                    <span>{activeTemporaryScorePreview.label}</span>
                    <span>
                      {new Date(activeTemporaryScorePreview.updatedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <div className="text-3xl font-semibold text-white">{activeTemporaryScorePreview.score}</div>
                      <div className="mt-1 text-sm text-emerald-100">{activeTemporaryScorePreview.detail}</div>
                    </div>
                    <div className="max-w-xl text-xs leading-5 text-emerald-100/80">{activeTemporaryScorePreview.note}</div>
                  </div>
                </div>
              ) : null}
              {process.env.NODE_ENV !== "production" && activeDsaCalculationOutput ? (
                <div className="rounded-[10px] border border-sky-700/40 bg-sky-950/20 p-3 text-sm leading-6 text-sky-50">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-sky-200">
                    <span>DSA calculated output</span>
                    <span>
                      {new Date(activeDsaCalculationOutput.updatedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[minmax(160px,220px)_1fr]">
                    <div>
                      <div className="text-3xl font-semibold text-white">{activeDsaCalculationOutput.score}</div>
                      <div className="mt-1 text-sm text-sky-100">{activeDsaCalculationOutput.totalTestsPassed} test cases passed</div>
                      <div className="mt-2 text-xs leading-5 text-sky-100/80">{activeDsaCalculationOutput.note}</div>
                    </div>
                    <div className="grid gap-3">
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {[
                          { label: "Correctness score", value: activeDsaCalculationOutput.correctnessScore },
                          { label: "Open test score", value: activeDsaCalculationOutput.openTestCaseScore },
                          { label: "Hidden test score", value: activeDsaCalculationOutput.hiddenTestCaseScore },
                          { label: "Expected code score", value: activeDsaCalculationOutput.expectedCodeScore },
                          { label: "Approach score", value: activeDsaCalculationOutput.approachScore },
                          { label: "Time complexity score", value: activeDsaCalculationOutput.timeComplexityScore },
                          { label: "Space complexity score", value: activeDsaCalculationOutput.spaceComplexityScore },
                          { label: "Edge case score", value: activeDsaCalculationOutput.edgeCaseScore },
                          { label: "Overall question score", value: activeDsaCalculationOutput.overallQuestionScore },
                        ].map((item) => (
                          <div key={item.label} className="rounded-[8px] border border-sky-700/30 bg-slate-950/40 p-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200">{item.label}</div>
                            <div className="mt-1 text-sm text-white">{typeof item.value === "number" ? `${item.value}%` : item.value}</div>
                          </div>
                        ))}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[8px] border border-sky-700/30 bg-slate-950/40 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200">Expected time complexity</div>
                          <div className="mt-1 text-sm text-white">{activeDsaCalculationOutput.expectedTimeComplexity}</div>
                          <div className="mt-1 text-xs text-sky-100/70">
                            Rank {activeDsaCalculationOutput.expectedTimeComplexityRank}
                            {typeof activeDsaCalculationOutput.studentTimeComplexityRank === "number"
                              ? `, student rank ${activeDsaCalculationOutput.studentTimeComplexityRank}, gap ${activeDsaCalculationOutput.timeComplexityRankGap}`
                              : ""}
                          </div>
                          <div className="mt-2 text-xs text-sky-100/90">
                            Calculated time complexity: {activeDsaCalculationOutput.studentTimeComplexityLabel}
                          </div>
                        </div>
                        <div className="rounded-[8px] border border-sky-700/30 bg-slate-950/40 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200">Expected space complexity</div>
                          <div className="mt-1 text-sm text-white">{activeDsaCalculationOutput.expectedSpaceComplexity}</div>
                          <div className="mt-1 text-xs text-sky-100/70">
                            Rank {activeDsaCalculationOutput.expectedSpaceComplexityRank}
                            {typeof activeDsaCalculationOutput.studentSpaceComplexityRank === "number"
                              ? `, student rank ${activeDsaCalculationOutput.studentSpaceComplexityRank}, gap ${activeDsaCalculationOutput.spaceComplexityRankGap}`
                              : ""}
                          </div>
                          <div className="mt-2 text-xs text-sky-100/90">
                            Calculated space complexity: {activeDsaCalculationOutput.studentSpaceComplexityLabel}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[8px] border border-sky-700/30 bg-slate-950/40 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200">Open tests passed</div>
                          <div className="mt-1 text-sm text-white">{activeDsaCalculationOutput.openTestsPassed}</div>
                        </div>
                        <div className="rounded-[8px] border border-sky-700/30 bg-slate-950/40 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200">Hidden tests passed</div>
                          <div className="mt-1 text-sm text-white">{activeDsaCalculationOutput.hiddenTestsPassed}</div>
                        </div>
                      </div>

                      <div className="rounded-[8px] border border-sky-700/30 bg-slate-950/40 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200">Matched expected code</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {activeDsaCalculationOutput.matchedExpectedCode.length ? (
                            activeDsaCalculationOutput.matchedExpectedCode.map((item) => (
                              <span key={item} className="rounded-full border border-sky-700/40 bg-sky-900/40 px-2 py-0.5 text-xs text-sky-50">
                                {item}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-sky-100/80">None matched</span>
                          )}
                        </div>
                        <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200">Missing expected code</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {activeDsaCalculationOutput.missingExpectedCode.length ? (
                            activeDsaCalculationOutput.missingExpectedCode.map((item) => (
                              <span key={item} className="rounded-full border border-rose-700/40 bg-rose-900/30 px-2 py-0.5 text-xs text-rose-50">
                                {item}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-sky-100/80">None missing</span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-[8px] border border-sky-700/30 bg-slate-950/40 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200">Expected approach</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {activeDsaCalculationOutput.expectedApproach.length ? (
                            activeDsaCalculationOutput.expectedApproach.map((item) => (
                              <span key={item} className="rounded-full border border-sky-700/40 bg-sky-900/40 px-2 py-0.5 text-xs text-sky-50">
                                {item}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-sky-100/80">Not configured</span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-[8px] border border-sky-700/30 bg-slate-950/40 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200">Expected code markers</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {activeDsaCalculationOutput.expectedCode.length ? (
                            activeDsaCalculationOutput.expectedCode.map((item) => (
                              <span key={item} className="rounded-full border border-sky-700/40 bg-sky-900/40 px-2 py-0.5 text-xs text-sky-50">
                                {item}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-sky-100/80">Not configured</span>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[8px] border border-sky-700/30 bg-slate-950/40 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200">Failed case analysis</div>
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-sky-50">
                            {activeDsaCalculationOutput.failedCaseAnalysis.length ? (
                              activeDsaCalculationOutput.failedCaseAnalysis.map((item) => <li key={item}>{item}</li>)
                            ) : (
                              <li>Not available</li>
                            )}
                          </ul>
                        </div>
                        <div className="rounded-[8px] border border-sky-700/30 bg-slate-950/40 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200">Missed edge cases</div>
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-sky-50">
                            {activeDsaCalculationOutput.missedEdgeCases.length ? (
                              activeDsaCalculationOutput.missedEdgeCases.map((item) => <li key={item}>{item}</li>)
                            ) : (
                              <li>Not available</li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 px-3 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.06)] backdrop-blur sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!previousQuestion || isExecuting}
                  onClick={() => !isExecuting && previousQuestion && changeQuestion(previousQuestion.id)}
                  className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                  Prev
                </button>
                <button
                  type="button"
                  disabled={!nextQuestion || isExecuting}
                  onClick={() => !isExecuting && nextQuestion && changeQuestion(nextQuestion.id)}
                  className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => updateActiveAnswer({ marked: !activeAnswer.marked })}
                  className={`inline-flex h-10 items-center gap-2 rounded-[10px] border px-3 text-sm font-semibold shadow-sm ${
                    activeAnswer.marked ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-300 text-slate-700"
                  }`}
                >
                  <Flag size={16} />
                  Review
                </button>
                <button
                  type="button"
                  onClick={runQuestion}
                  disabled={isExecuting || isIntegrityLocked}
                  className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <Play size={16} />
                  {isExecuting ? "Running..." : activeQuestion.engine === "mcq" ? "Check" : "Run"}
                </button>
                <button
                  type="button"
                  onClick={submitQuestion}
                  disabled={isExecuting || isTimedOut || isSectionTimedOut || isIntegrityLocked}
                  className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-emerald-700 px-3 text-sm font-semibold text-white shadow-sm shadow-emerald-900/10 hover:bg-emerald-800 disabled:opacity-40"
                >
                  <CheckCircle2 size={16} />
                  Submit Question
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function QuestionNavigator({
  activeQuestionId,
  assessmentBank,
  answers,
  attempted,
  submitted,
  marked,
  activeSection,
  sectionStatuses,
  disabled,
  pinned = true,
  onTogglePinned,
  onSelect,
}: {
  activeQuestionId: string;
  assessmentBank: AssessmentBank;
  answers: Record<string, AnswerState>;
  attempted: number;
  submitted: number;
  marked: number;
  activeSection: AssessmentSectionId;
  sectionStatuses: Record<AssessmentSectionId, SectionStatus>;
  disabled?: boolean;
  pinned?: boolean;
  onTogglePinned?: () => void;
  onSelect: (questionId: string) => void;
}) {
  return (
    <div className="grid gap-5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Question Panel</p>
          <p className="text-sm font-semibold text-slate-950">{activeSection} section</p>
        </div>
        {onTogglePinned ? (
          <button
            type="button"
            onClick={onTogglePinned}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-slate-200 text-slate-700 hover:bg-slate-50"
            aria-label={pinned ? "Unpin question panel" : "Pin question panel"}
            title={pinned ? "Unpin question panel" : "Pin question panel"}
          >
            {pinned ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-[8px] bg-slate-50 p-2">
          <div className="font-semibold text-slate-950">{attempted}</div>
          <div className="text-slate-500">Touched</div>
        </div>
        <div className="rounded-[8px] bg-emerald-50 p-2">
          <div className="font-semibold text-emerald-800">{submitted}</div>
          <div className="text-emerald-700">Submitted</div>
        </div>
        <div className="rounded-[8px] bg-amber-50 p-2">
          <div className="font-semibold text-amber-800">{marked}</div>
          <div className="text-amber-700">Review</div>
        </div>
      </div>

      {sectionOrder.map((section) => {
        const Icon = sectionIcon(section);
        const sectionQuestions = assessmentBank.questions.filter((question) => question.section === section);
        const sectionStatus = sectionStatuses[section];
        return (
          <div key={section}>
            <div className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold text-slate-900">
              <span className="flex items-center gap-2">
              <Icon size={17} />
              {section}
              </span>
              <span className="text-xs font-medium text-slate-500">
                {sectionStatus === "active" ? "Active" : sectionStatus === "completed" ? "Completed" : "Unlocked"}
              </span>
            </div>
            <div className="grid gap-2">
              {sectionQuestions.map((question, index) => {
                const answer = answers[question.id] || initialAnswer(question);
                return (
                  <button
                    key={question.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelect(question.id)}
                    className={`grid grid-cols-[32px_1fr_auto] items-center gap-2 rounded-[8px] border px-2 py-2 text-left text-sm ${
                      activeQuestionId === question.id ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <span className={`flex h-7 w-7 items-center justify-center rounded-[7px] border text-xs font-semibold ${statusClass(answer.status, answer.marked)}`}>
                      {index + 1}
                    </span>
                    <span className="truncate text-slate-800">{question.title}</span>
                    {answer.marked ? <Flag size={14} className="text-amber-600" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QuestionPrompt({ question, visible }: { question: AssessmentQuestion; visible: boolean }) {
  return (
    <article className={`${visible ? "block" : "hidden"} min-h-0 overflow-auto rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm lg:block lg:h-fit lg:self-start sm:p-5`}>
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Problem Brief</p>
          <p className="mt-1 text-xs text-slate-500">Read the scenario carefully before coding.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {question.engine.toUpperCase()}
        </span>
      </div>

      {question.title ? (
        <div className="mb-3 rounded-[12px] border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Question</p>
          <h2 className="mt-1 text-sm font-semibold leading-6 text-slate-950 break-words">{question.title}</h2>
        </div>
      ) : null}

      <div className="rounded-[12px] bg-slate-50 p-4">
        <p className="whitespace-pre-wrap break-words text-[13px] leading-6 text-slate-700">{question.prompt}</p>
      </div>

      {question.function_signature ? (
        <div className="mt-4 rounded-[12px] border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Required Interface</p>
          <code className="mt-2 block font-mono text-sm text-slate-900">{question.function_signature}</code>
        </div>
      ) : null}

      {question.constraints?.length ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-slate-950">Constraints</h3>
          <ul className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            {question.constraints.map((constraint) => (
              <li key={constraint} className="rounded-[10px] bg-slate-50 px-3 py-2 font-mono text-xs">
                {constraint}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/*
      {question.expected_approach?.length ? (
        <div className="mt-4 rounded-[12px] border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle size={16} />
            Evaluation Focus
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {question.expected_approach.map((item) => (
              <span key={item} className="rounded-full bg-white px-2 py-1 text-xs font-medium text-amber-900">
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      */}

      {question.test_cases?.length ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-slate-950">Open Test Cases</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Hidden cases from the source document are reserved for final evaluation.
          </p>
          <div className="mt-2 overflow-hidden rounded-[12px] border border-slate-200">
            <div className="max-h-80 overflow-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="border-b border-slate-200 px-3 py-2 font-semibold">#</th>
                    <th className="border-b border-slate-200 px-3 py-2 font-semibold">Input</th>
                    <th className="border-b border-slate-200 px-3 py-2 font-semibold">Expected Output</th>
                    <th className="border-b border-slate-200 px-3 py-2 font-semibold">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {question.test_cases.slice(0, 5).map((testCase) => (
                    <tr key={testCase.number}>
                      <td className="px-3 py-2 font-semibold text-slate-700">{testCase.number}</td>
                      <td className="px-3 py-2 font-mono text-slate-700">{testCase.input}</td>
                      <td className="px-3 py-2 font-mono text-slate-700">{testCase.expected_output}</td>
                      <td className="px-3 py-2 text-slate-600">{testCase.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {question.engine === "sql" && question.expected_columns?.length ? (
        <div className="mt-4 rounded-[12px] border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Expected Columns</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {question.expected_columns.map((column) => (
              <span key={column} className="rounded-full bg-white px-2 py-1 font-mono text-xs text-slate-700">
                {column}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {question.engine === "sql" ? <SampleInputData question={question} /> : null}
    </article>
  );
}

function SampleInputData({ question }: { question: AssessmentQuestion }) {
  if (question.sample_data_tables?.length) {
    return (
      <details className="mt-4 rounded-[12px] border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer list-none border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Sample Input Data
        </summary>
        <div className="grid gap-4 p-3">
          {question.sample_data_tables.map((table) => (
            <div key={table.name} className="overflow-hidden rounded-[10px] border border-slate-200">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
                <h3 className="font-mono text-sm font-semibold text-slate-900">{table.name}</h3>
                <span className="text-xs text-slate-500">{table.rows.length} rows</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      {(table.columns.length ? table.columns : table.rows[0]?.map((_, index) => `column_${index + 1}`) || []).map((column, ci, arr) => (
                        <th key={column} className={`whitespace-nowrap border-b border-slate-200 px-3 py-2 font-mono font-semibold min-w-[100px] ${ci < arr.length - 1 ? 'border-r border-slate-200' : ''}`}>
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {table.rows.map((row, rowIndex) => (
                      <tr key={`${table.name}-${rowIndex}`} className="hover:bg-slate-50">
                        {row.map((value, valueIndex, valArr) => (
                          <td key={`${table.name}-${rowIndex}-${valueIndex}`} className={`border-b border-slate-100 px-3 py-2 font-mono text-slate-700 break-all ${valueIndex < valArr.length - 1 ? 'border-r border-slate-100' : ''}`}>
                            {value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </details>
    );
  }

  if (!question.sample_data_sql) return null;

  return (
    <details className="mt-4 overflow-hidden rounded-[12px] border border-slate-200 bg-slate-950 shadow-sm">
      <summary className="cursor-pointer list-none border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
        Sample Input Data
      </summary>
      <pre className="max-h-80 overflow-auto p-3 font-mono text-xs leading-6 text-slate-100">
        {question.sample_data_sql}
      </pre>
    </details>
  );
}

function TestResultsPanel({
  testResults,
  animatingIndex,
}: {
  testResults: TestResultsOutput;
  animatingIndex: number;
}) {
  const { test_results, total, passed } = testResults;
  const allVisible = animatingIndex < 0;
  const visibleOnly = test_results.every((test) => test.displayStatus === "visible");

  return (
    <div className="rounded-[8px] border border-slate-200 bg-white overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {visibleOnly ? "Visible Test Cases" : "Test Results"}
        </span>
        <span className={`text-xs font-semibold ${visibleOnly ? "text-slate-600" : passed === total ? "text-emerald-700" : passed >= total / 2 ? "text-amber-700" : "text-red-700"}`}>
          {visibleOnly ? `${total} visible` : `${passed}/${total} passed`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-100">
        <div
          className={`h-full transition-all duration-300 ${visibleOnly ? "bg-slate-400" : "bg-emerald-600"}`}
          style={{ width: `${visibleOnly ? 100 : (passed / total) * 100}%` }}
        />
      </div>

      <div className="max-h-64 overflow-auto divide-y divide-slate-100">
        {test_results.map((test, index) => {
          const isVisible = allVisible || index <= animatingIndex;
          const isCurrentAnimating = index === animatingIndex && !allVisible;

          return (
            <div
              key={test.number}
              className={`grid grid-cols-[36px_1fr_1fr_1fr_64px] gap-2 px-3 py-2 text-xs transition-all duration-200 ${
                isVisible ? "opacity-100" : "opacity-0"
              } ${isCurrentAnimating ? "bg-amber-50" : test.displayStatus === "visible" ? "bg-slate-50" : test.passed ? "bg-emerald-50/30" : "bg-red-50/30"}`}
            >
              <span className="font-semibold text-slate-600 flex items-center">
                {test.number}
              </span>
              <div className="truncate" title={test.input}>
                <span className="text-slate-500">Input: </span>
                <code className="font-mono text-slate-800">{test.input.length > 30 ? test.input.substring(0, 30) + "..." : test.input}</code>
              </div>
              <div className="truncate" title={test.expected}>
                <span className="text-slate-500">Expected: </span>
                <code className="font-mono text-slate-800">{test.expected.length > 25 ? test.expected.substring(0, 25) + "..." : test.expected}</code>
              </div>
              <div className="truncate" title={test.actual}>
                <span className="text-slate-500">Actual: </span>
                <code className={`font-mono ${test.displayStatus === "visible" ? "text-slate-600" : test.passed ? "text-emerald-700" : "text-red-700"}`}>
                  {test.actual.length > 25 ? test.actual.substring(0, 25) + "..." : test.actual}
                </code>
              </div>
              <div className="flex items-center justify-end">
                {test.displayStatus === "visible" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-slate-700 font-semibold">
                    VISIBLE
                  </span>
                ) : test.passed ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 font-semibold">
                    PASS
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-red-800 font-semibold">
                    FAIL
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {test_results.some((t) => t.purpose) ? (
        <div className="border-t border-slate-200 bg-slate-50 px-3 py-2">
          <details className="text-xs">
            <summary className="cursor-pointer font-medium text-slate-600">View test case description</summary>
            <div className="mt-2 space-y-1">
              {test_results.map((test) => (
                <div key={test.number} className="text-slate-500">
                  <span className="font-medium text-slate-700">#{test.number}:</span> {test.purpose}
                </div>
              ))}
            </div>
          </details>
        </div>
      ) : null}
    </div>
  );
}

function AnswerPanel({
  question,
  assessmentBank,
  answer,
  visible,
  onValueChange,
  onLanguageChange,
  onMcqChange,
}: {
  question: AssessmentQuestion;
  assessmentBank?: AssessmentBank;
  answer: AnswerState;
  visible: boolean;
  onValueChange: (value: string) => void;
  onLanguageChange: (language: string) => void;
  onMcqChange: (selected: string[]) => void;
}) {
  if (question.engine === "mcq") {
    return (
      <section className={`${visible ? "block" : "hidden"} self-start overflow-auto rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm lg:block lg:h-fit lg:max-h-none sm:p-5`}>
        <div className="mb-4 border-b border-slate-100 pb-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Answer Console</p>
          <p className="mt-1 text-xs text-slate-500">Select the best option for this scenario.</p>
        </div>
        <McqPanel question={question} selected={answer.selectedOptions} onChange={onMcqChange} />
      </section>
    );
  }

  const languageOptions =
    question.engine === "sql"
      ? [{ id: "sql", label: "PostgreSQL 15" }]
      : (assessmentBank?.languages || []).filter((language) => question.allowed_languages?.includes(language.id));

  return (
    <section className={`${visible ? "grid" : "hidden"} min-h-0 grid-rows-[auto_minmax(520px,1fr)] overflow-hidden rounded-[14px] border border-slate-800 bg-slate-950 shadow-sm lg:grid`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-3 py-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-400">Answer Console</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {question.engine === "sql" ? "Read-only PostgreSQL sandbox" : "Function-signature answer"}
          </p>
        </div>
        <select
          value={answer.language}
          onChange={(event) => onLanguageChange(event.target.value)}
          className="h-9 rounded-[8px] border border-slate-700 bg-slate-950 px-3 text-sm font-semibold text-slate-100 outline-none focus:border-emerald-500"
        >
          {languageOptions.map((language) => (
            <option key={language.id} value={language.id}>
              {getLanguageDisplayLabel(language)}
            </option>
          ))}
        </select>
      </div>
      <div className="min-h-0 p-3">
        <CodeEditor
          value={answer.value}
          language={question.engine === "sql" ? "sql" : answer.language}
          onChange={onValueChange}
          minHeight={520}
        />
      </div>
    </section>
  );
}
