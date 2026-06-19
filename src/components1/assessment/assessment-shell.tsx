"use client";

import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code2,
  Database,
  FileQuestion,
  Flag,
  Menu,
  Play,
  Save,
  Send,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
};

type ActiveTab = "problem" | "answer" | "results";

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

const defaultLanguage = "python";

type SqlRunResponse = {
  columns?: string[];
  rows?: Array<Record<string, string | number | boolean | null>>;
  row_count?: number;
  execution_ms?: number;
  error?: string;
  message?: string;
};

function visibleTestResultsForQuestion(question: AssessmentQuestion): TestResultsOutput | null {
  const cases = question.section === "OOPs"
    ? []
    : question.open_test_cases?.length
      ? question.open_test_cases
      : question.test_cases?.slice(0, 5) || [];
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
  };
}

function formatTime(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
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

function storageKeyForBank(assessmentBank: AssessmentBank, assessmentInstanceId?: string, studentId?: string) {
  return `joraiq-assessment:${studentId || "anonymous"}:${assessmentInstanceId || assessmentBank.assessment.id}`;
}

function loadInitialSnapshot(assessmentBank: AssessmentBank, assessmentInstanceId?: string, studentId?: string) {
  const questions = assessmentBank.questions;
  const storageKey = storageKeyForBank(assessmentBank, assessmentInstanceId, studentId);
  const fallback = {
    activeQuestionId: questions[0]?.id || "",
    answers: createInitialAnswers(questions),
    remainingSeconds: assessmentBank.assessment.duration_minutes * 60,
    tabEvents: 0,
  };

  if (typeof window === "undefined") return fallback;

  const saved = window.localStorage.getItem(storageKey);
  if (!saved) {
    window.localStorage.setItem(`${storageKey}:startedAt`, new Date().toISOString());
    return fallback;
  }

  try {
    const parsed = JSON.parse(saved) as {
      answers?: Record<string, AnswerState>;
      activeQuestionId?: string;
      startedAt?: string;
      tabEvents?: number;
    };
    const startedAt = parsed.startedAt || window.localStorage.getItem(`${storageKey}:startedAt`);
    const elapsed = startedAt ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000) : 0;
    return {
      activeQuestionId:
        parsed.activeQuestionId && questions.some((question) => question.id === parsed.activeQuestionId)
          ? parsed.activeQuestionId
          : fallback.activeQuestionId,
      answers: { ...fallback.answers, ...(parsed.answers || {}) },
      remainingSeconds: Math.max(0, assessmentBank.assessment.duration_minutes * 60 - elapsed),
      tabEvents: parsed.tabEvents || 0,
    };
  } catch {
    window.localStorage.removeItem(storageKey);
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
  const [initialSnapshot] = useState(() => loadInitialSnapshot(assessmentBank, assessmentInstanceId, studentId));
  const [activeQuestionId, setActiveQuestionId] = useState(initialSnapshot.activeQuestionId);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>(initialSnapshot.answers);
  const [remainingSeconds, setRemainingSeconds] = useState(initialSnapshot.remainingSeconds);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("answer");
  const [tabEvents, setTabEvents] = useState(initialSnapshot.tabEvents);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [sqlResult, setSqlResult] = useState<SqlRunResponse | null>(null);
  const [testResults, setTestResults] = useState<TestResultsOutput | null>(null);
  const [animatingTestIndex, setAnimatingTestIndex] = useState<number>(-1);

  const activeIndex = questions.findIndex((question) => question.id === activeQuestionId);
  const activeQuestion = questions[Math.max(0, activeIndex)];
  const activeAnswer = answers[activeQuestion.id] || initialAnswer(activeQuestion);

  const questionsBySection = useMemo(
    () =>
      sectionOrder.map((section) => ({
        section,
        questions: questions.filter((question) => question.section === section),
        meta: assessmentBank.assessment.sections.find((item) => item.name === section),
      })),
    [assessmentBank.assessment.sections, questions],
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRemainingSeconds((current) => {
        const next = Math.max(0, current - 1);
        if (next === 0 && current !== 0) {
          setAnswers((answersCurrent) =>
            Object.fromEntries(
              Object.entries(answersCurrent).map(([questionId, answer]) => [
                questionId,
                { ...answer, status: answer.status === "unvisited" ? "saved" : answer.status },
              ]),
            ),
          );
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
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
          answers,
          activeQuestionId,
          startedAt,
          tabEvents,
          savedAt: new Date().toISOString(),
        }),
      );
      setLastSavedAt(new Date());
    }, 6000);

    return () => window.clearInterval(interval);
  }, [activeQuestionId, answers, storageKey, tabEvents]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) setTabEvents((count) => count + 1);
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

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

  function changeQuestion(questionId: string) {
    setActiveQuestionId(questionId);
    setActiveTab("answer");
    setNavOpen(false);
    setAnswers((current) => ({
      ...current,
      [questionId]: {
        ...(current[questionId] || initialAnswer(questions.find((question) => question.id === questionId) || activeQuestion)),
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

  async function executeCode(action: "run" | "submit") {
    if (isExecuting) return;

    setIsExecuting(true);
    const visibleFallback = visibleTestResultsForQuestion(activeQuestion);
    setTestResults(visibleFallback);
    setAnimatingTestIndex(-1);
    updateActiveAnswer({
      resultMessage: `${action === "run" ? "Running test cases" : "Submitting for evaluation"}...`,
    });
    setActiveTab("results");

    try {
      const response = await fetch(`/api/code/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attempt_id: "local-browser-attempt",
          question_id: activeQuestion.id,
          language: activeAnswer.language,
          source_code: activeAnswer.value,
          run_type: action,
        }),
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
        const showCaseResults = activeQuestion.section !== "OOPs";
        if (showCaseResults) {
          setTestResults(parsedTestResults);
        } else {
          setTestResults(null);
        }
        const total = parsedTestResults.test_results.length;
        if (showCaseResults) {
          for (let i = 0; i < total; i++) {
            setAnimatingTestIndex(i);
            await new Promise((r) => setTimeout(r, 150));
          }
        }
        setAnimatingTestIndex(-1);

        const passed = parsedTestResults.passed;
        const totalTests = parsedTestResults.total;
        updateActiveAnswer({
          runs: action === "run" ? activeAnswer.runs + 1 : activeAnswer.runs,
          submissions: action === "submit" ? activeAnswer.submissions + 1 : activeAnswer.submissions,
          status: action === "submit" ? "submitted" : "ran",
          resultMessage: `Test results: ${passed}/${totalTests} passed (${Math.round((passed / totalTests) * 100)}%)`,
        });
      } else {
        if (visibleFallback) {
          setTestResults(visibleFallback);
        }
        // No structured results - fall back to raw output display
        const resultLines = [
          isError ? `Compiler status: ${status}` : `Compiler status: ${status || "Completed"}`,
          time ? `Runtime: ${time}s` : null,
          compileOutput ? `Compile output:\n${compileOutput}` : null,
          stdout ? `Stdout:\n${stdout}` : null,
          stderr ? `Stderr:\n${stderr}` : null,
        ].filter(Boolean);

        updateActiveAnswer({
          runs: action === "run" ? activeAnswer.runs + 1 : activeAnswer.runs,
          submissions: action === "submit" ? activeAnswer.submissions + 1 : activeAnswer.submissions,
          status: action === "submit" ? "submitted" : "ran",
          resultMessage: resultLines.join("\n\n") || "Compiler completed with no output.",
        });
      }
    } catch (error) {
      updateActiveAnswer({
        runs: action === "run" ? activeAnswer.runs + 1 : activeAnswer.runs,
        submissions: action === "submit" ? activeAnswer.submissions + 1 : activeAnswer.submissions,
        status: action === "submit" ? "submitted" : "ran",
        resultMessage: error instanceof Error ? error.message : "Compiler request failed.",
      });
    } finally {
      setIsExecuting(false);
    }
  }

  async function executeSql(action: "run" | "submit") {
    if (isExecuting) return;

    setIsExecuting(true);
    updateActiveAnswer({
      resultMessage: `${action === "run" ? "Running SQL query" : "Submitting SQL query"}...`,
    });
    setSqlResult(null);
    setActiveTab("results");

    try {
      const response = await fetch(`/api/sql/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attempt_id: "local-browser-attempt",
          question_id: activeQuestion.id,
          query: activeAnswer.value,
          mode: action === "submit" ? "hidden" : "visible",
        }),
      });
      const payload = (await response.json().catch(() => null)) as SqlRunResponse | null;

      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || `SQL request failed with status ${response.status}`);
      }

      setSqlResult(payload);
      updateActiveAnswer({
        runs: action === "run" ? activeAnswer.runs + 1 : activeAnswer.runs,
        submissions: action === "submit" ? activeAnswer.submissions + 1 : activeAnswer.submissions,
        status: action === "submit" ? "submitted" : "ran",
        sqlExecutionMs: typeof payload?.execution_ms === "number" ? payload.execution_ms : null,
        resultMessage: payload?.error
          ? `SQL error:\n${payload.error}`
          : `SQL completed. Rows: ${payload?.row_count ?? 0}. Execution: ${payload?.execution_ms ?? 0} ms.`,
      });
    } catch (error) {
      setSqlResult(null);
      updateActiveAnswer({
        runs: action === "run" ? activeAnswer.runs + 1 : activeAnswer.runs,
        submissions: action === "submit" ? activeAnswer.submissions + 1 : activeAnswer.submissions,
        status: action === "submit" ? "submitted" : "ran",
        resultMessage: error instanceof Error ? error.message : "SQL request failed.",
      });
    } finally {
      setIsExecuting(false);
    }
  }

  function runQuestion() {
    if (isExecuting) {
      updateActiveAnswer({
        resultMessage: "A compiler request is already running.",
      });
      setActiveTab("results");
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
      resultMessage: "MCQ answer saved locally. Final MCQ scoring will run during assessment submission.",
    });
    setActiveTab("results");
  }

  function submitQuestion() {
    if (isExecuting) {
      updateActiveAnswer({
        resultMessage: "A compiler request is already running.",
      });
      setActiveTab("results");
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

    updateActiveAnswer({
      submissions: activeAnswer.submissions + 1,
      status: "submitted",
      resultMessage: "Question submitted. Hidden results remain private until final evaluation.",
    });
    const nextQuestion = questions[activeIndex + 1];
    if (nextQuestion) {
      changeQuestion(nextQuestion.id);
      return;
    }

    setActiveTab("results");
  }

  function saveNow() {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        answers,
        activeQuestionId,
        startedAt: localStorage.getItem(`${storageKey}:startedAt`) || new Date().toISOString(),
        tabEvents,
        savedAt: new Date().toISOString(),
      }),
    );
    setLastSavedAt(new Date());
  }

  async function submitAssessment() {
    if (isExecuting || isFinalizing) return;

    saveNow();
    setIsFinalizing(true);

    try {
      const {
        data: { session },
      } = await authClient.auth.getSession();
      const submissionBody = {
        assessment_id: assessmentInstanceId || assessmentBank.assessment.id,
        started_at: localStorage.getItem(`${storageKey}:startedAt`) || new Date().toISOString(),
        submitted_at: new Date().toISOString(),
        duration_minutes: assessmentBank.assessment.duration_minutes,
        tab_events: tabEvents,
        access_token: session?.access_token || null,
        answers,
      };
      const response = await fetch("/api/assessment/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submissionBody),
      });
      const payload = (await response.json().catch(() => null)) as { attempt_id?: string; message?: string } | null;

      if (!response.ok) {
        if (response.status === 409) {
          localStorage.removeItem(storageKey);
          localStorage.removeItem(`${storageKey}:startedAt`);
          router.replace("/assessment/report?mode=auto");
          router.refresh();
          return;
        }
        throw new Error(payload?.message || `Final submission failed with status ${response.status}`);
      }

      if (payload?.attempt_id) {
        localStorage.setItem(`assessment-finalize:${payload.attempt_id}`, JSON.stringify(submissionBody));
      }
      localStorage.removeItem(storageKey);
      localStorage.removeItem(`${storageKey}:startedAt`);
      const reportPath = payload?.attempt_id
        ? `/assessment/report?attemptId=${encodeURIComponent(payload.attempt_id)}`
        : "/assessment/report";
      router.replace(reportPath);
      router.refresh();
    } catch (error) {
      updateActiveAnswer({
        resultMessage: error instanceof Error ? error.message : "Final assessment submission failed.",
      });
      setActiveTab("results");
    } finally {
      setIsFinalizing(false);
    }
  }

  const attempted = Object.values(answers).filter((answer) => answer.status !== "unvisited").length;
  const submitted = Object.values(answers).filter((answer) => answer.status === "submitted").length;
  const marked = Object.values(answers).filter((answer) => answer.marked).length;
  const isTimedOut = remainingSeconds === 0;

  return (
    <main className="flex min-h-dvh flex-col bg-[#f4f7f5] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
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
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">JoraIQ Assessment</p>
              <h1 className="text-sm font-semibold sm:text-base">{assessmentBank.assessment.title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 md:block">
              Saved {lastSavedAt ? lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "pending"}
            </div>
            <div className={`inline-flex h-10 items-center gap-2 rounded-[8px] px-3 text-sm font-semibold ${remainingSeconds < 600 ? "bg-red-50 text-red-800" : "bg-slate-950 text-white"}`}>
              <Clock size={17} />
              {formatTime(remainingSeconds)}
            </div>
            <button
              type="button"
              onClick={saveNow}
              className="hidden h-10 items-center gap-2 rounded-[8px] border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:inline-flex"
            >
              <Save size={16} />
              Save
            </button>
            <button
              type="button"
              onClick={submitAssessment}
              disabled={isExecuting || isFinalizing}
              className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-40"
            >
              <Send size={16} />
              <span className="hidden sm:inline">{isFinalizing ? "Submitting..." : "Submit Assessment"}</span>
            </button>
          </div>
        </div>

        <div className="grid gap-2 border-t border-slate-100 px-3 py-2 sm:grid-cols-4 sm:px-5">
          {questionsBySection.map(({ section, questions: sectionQuestions, meta }) => {
            const done = sectionQuestions.filter((question) => answers[question.id]?.status === "submitted").length;
            return (
              <div key={section} className="rounded-[8px] bg-slate-50 px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800">{section}</span>
                  <span className="text-slate-500">{done}/{sectionQuestions.length}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-emerald-700" style={{ width: `${(done / sectionQuestions.length) * 100}%` }} />
                </div>
                <p className="mt-1 text-slate-500">{meta?.duration_minutes} min</p>
              </div>
            );
          })}
        </div>
      </header>

      <div className="grid flex-1 lg:grid-cols-[300px_1fr]">
        <aside className="hidden border-r border-slate-200 bg-white lg:block">
          <QuestionNavigator
            activeQuestionId={activeQuestion.id}
            assessmentBank={assessmentBank}
            answers={answers}
            attempted={attempted}
            marked={marked}
            submitted={submitted}
            disabled={isExecuting}
            onSelect={changeQuestion}
          />
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
                disabled={isExecuting}
                onSelect={changeQuestion}
              />
            </aside>
          </div>
        ) : null}

        <section className="grid min-h-0 grid-rows-[auto_1fr_auto]">
          <div className="border-b border-slate-200 bg-white px-3 py-3 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-[8px] bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
                    {activeQuestion.section}
                  </span>
                  <span className="rounded-[8px] bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                    {activeQuestion.difficulty || activeQuestion.topic || "Scenario"}
                  </span>
                  <span className="rounded-[8px] bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                    {activeQuestion.marks || 5} marks
                  </span>
                </div>
                <h2 className="mt-2 text-lg font-semibold">{activeQuestion.title}</h2>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                {isTimedOut ? (
                  <span className="rounded-[8px] border border-red-200 bg-red-50 px-2 py-1 font-semibold text-red-800">
                    Time expired
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

          <div className="grid min-h-0 gap-0 overflow-hidden lg:grid-cols-[minmax(360px,0.95fr)_minmax(420px,1.2fr)]">
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

          <div className={`${activeTab === "results" ? "block" : "hidden"} border-t border-slate-200 bg-white p-3 lg:block sm:p-4`}>
            <div className="grid gap-3">
              {testResults && activeQuestion.engine === "code" && activeQuestion.section !== "OOPs" ? (
                <TestResultsPanel
                  testResults={testResults}
                  animatingIndex={animatingTestIndex}
                />
              ) : null}
              <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                {activeAnswer.resultMessage}
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
            </div>
          </div>

          <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white px-3 py-3 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={activeIndex <= 0 || isExecuting}
                  onClick={() => !isExecuting && changeQuestion(questions[activeIndex - 1].id)}
                  className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-slate-300 px-3 text-sm font-semibold text-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                  Prev
                </button>
                <button
                  type="button"
                  disabled={activeIndex >= questions.length - 1 || isExecuting}
                  onClick={() => !isExecuting && changeQuestion(questions[activeIndex + 1].id)}
                  className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-slate-300 px-3 text-sm font-semibold text-slate-700 disabled:opacity-40"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => updateActiveAnswer({ marked: !activeAnswer.marked })}
                  className={`inline-flex h-10 items-center gap-2 rounded-[8px] border px-3 text-sm font-semibold ${
                    activeAnswer.marked ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-300 text-slate-700"
                  }`}
                >
                  <Flag size={16} />
                  Review
                </button>
                <button
                  type="button"
                  onClick={runQuestion}
                  disabled={isExecuting}
                  className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <Play size={16} />
                  {isExecuting ? "Running..." : activeQuestion.engine === "mcq" ? "Check" : "Run"}
                </button>
                <button
                  type="button"
                  onClick={submitQuestion}
                  disabled={isExecuting}
                  className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-40"
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
  disabled,
  onSelect,
}: {
  activeQuestionId: string;
  assessmentBank: AssessmentBank;
  answers: Record<string, AnswerState>;
  attempted: number;
  submitted: number;
  marked: number;
  disabled?: boolean;
  onSelect: (questionId: string) => void;
}) {
  return (
    <div className="grid gap-5 p-4">
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
        return (
          <div key={section}>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Icon size={17} />
              {section}
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
  const openTestCases = question.section === "OOPs"
    ? []
    : question.open_test_cases?.length
      ? question.open_test_cases
      : question.test_cases?.slice(0, 5) || [];

  return (
    <article className={`${visible ? "block" : "hidden"} min-h-0 overflow-auto border-r border-slate-200 bg-white p-4 lg:block lg:h-fit lg:self-start sm:p-5`}>
      <div className="prose prose-slate max-w-none">
        <p className="whitespace-pre-line text-sm leading-7 text-slate-700">{question.prompt}</p>
      </div>

      {question.function_signature ? (
        <div className="mt-4 rounded-[8px] border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Required Interface</p>
          <code className="mt-2 block font-mono text-sm text-slate-900">{question.function_signature}</code>
        </div>
      ) : null}

      {question.constraints?.length ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-slate-950">Constraints</h3>
          <ul className="mt-2 grid gap-2 text-sm text-slate-700">
            {question.constraints.map((constraint) => (
              <li key={constraint} className="rounded-[8px] bg-slate-50 px-3 py-2 font-mono text-xs">
                {constraint}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {question.expected_approach?.length ? (
        <div className="mt-4 rounded-[8px] border border-amber-200 bg-amber-50 p-3">
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

      {openTestCases.length ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-slate-950">Open Test Cases</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Hidden cases from the source document are reserved for final evaluation.
          </p>
          <div className="mt-2 overflow-hidden rounded-[8px] border border-slate-200">
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
                  {openTestCases.map((testCase) => (
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
        <div className="mt-4 rounded-[8px] border border-slate-200 bg-slate-50 p-3">
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
      <div className="mt-4 rounded-[8px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Sample Input Data</p>
        </div>
        <div className="grid gap-4 p-3">
          {question.sample_data_tables.map((table) => (
            <div key={table.name} className="overflow-hidden rounded-[8px] border border-slate-200">
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
      </div>
    );
  }

  if (!question.sample_data_sql) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-[8px] border border-slate-200 bg-slate-950 shadow-sm">
      <div className="border-b border-slate-800 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Sample Input Data</p>
      </div>
      <pre className="max-h-80 overflow-auto p-3 font-mono text-xs leading-6 text-slate-100">
        {question.sample_data_sql}
      </pre>
    </div>
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
              <div className="min-w-0 whitespace-normal break-words" title={test.input}>
                <span className="text-slate-500">Input: </span>
                <code className="font-mono text-slate-800">{test.input}</code>
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
            <summary className="cursor-pointer font-medium text-slate-600">View test case descriptions</summary>
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
      <section className={`${visible ? "block" : "hidden"} min-h-0 overflow-auto bg-[#f8faf9] p-4 lg:block lg:h-fit lg:self-start sm:p-5`}>
        <McqPanel question={question} selected={answer.selectedOptions} onChange={onMcqChange} />
      </section>
    );
  }

  const languageOptions =
    question.engine === "sql"
      ? [{ id: "sql", label: "PostgreSQL 15" }]
      : (assessmentBank?.languages || []).filter((language) => question.allowed_languages?.includes(language.id));

  return (
    <section className={`${visible ? "grid" : "hidden"} min-h-0 grid-rows-[auto_1fr] bg-slate-950 lg:grid`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
        <select
          value={answer.language}
          onChange={(event) => onLanguageChange(event.target.value)}
          className="h-9 rounded-[8px] border border-slate-700 bg-slate-950 px-3 text-sm font-semibold text-slate-100"
        >
          {languageOptions.map((language) => (
            <option key={language.id} value={language.id}>
              {getLanguageDisplayLabel(language)}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-400">
          {question.engine === "sql" ? "Read-only PostgreSQL sandbox" : "Function-signature answer"}
        </span>
      </div>
      <CodeEditor value={answer.value} language={question.engine === "sql" ? "sql" : answer.language} onChange={onValueChange} />
    </section>
  );
}
