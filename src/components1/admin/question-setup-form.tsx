"use client";

import { useRef, useState } from "react";

type SubjectOption = {
  id: string;
  name: string;
};

type QuestionSetupFormProps = {
  assessmentId: string;
  subjects: SubjectOption[];
  action: (formData: FormData) => void;
};

const questionTypes = [
  { value: "coding", label: "Coding" },
  { value: "mcq", label: "MCQ" },
  { value: "subjective", label: "Subjective" },
];

const toolbarButtons = [
  { command: "bold", label: "B" },
  { command: "italic", label: "I" },
  { command: "insertUnorderedList", label: "List" },
  { command: "formatBlock", value: "pre", label: "Code" },
];

export function QuestionSetupForm({ assessmentId, subjects, action }: QuestionSetupFormProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [questionType, setQuestionType] = useState("coding");
  const [promptHtml, setPromptHtml] = useState("");

  const isCoding = questionType === "coding";
  const isMcq = questionType === "mcq";
  const needsExpectedAnswer = questionType === "subjective";

  function runCommand(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    setPromptHtml(editorRef.current?.innerHTML || "");
  }

  return (
    <form action={action} className="mt-5 grid gap-4">
      <input type="hidden" name="assessment_id" value={assessmentId} />
      <input type="hidden" name="prompt" value={promptHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()} />
      <input type="hidden" name="prompt_rich_text" value={promptHtml} />

      <div className="grid gap-3 md:grid-cols-4">
        <select name="subject_id" className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm">
          <option value="">Select subject</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
        <select
          name="question_type"
          value={questionType}
          onChange={(event) => setQuestionType(event.target.value)}
          className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm"
        >
          {questionTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        <input name="difficulty" placeholder="Difficulty" className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm" />
        <input name="marks" type="number" min="1" placeholder="Marks" className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm" />
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_180px]">
        <input name="title" required placeholder="Question title" className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm" />
        <input name="sort_order" type="number" placeholder="Sort order" className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm" />
      </div>

      <div className="overflow-hidden rounded-[8px] border border-slate-300 bg-white">
        <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
          {toolbarButtons.map((button) => (
            <button
              key={`${button.command}-${button.value || ""}`}
              type="button"
              onClick={() => runCommand(button.command, button.value)}
              className="rounded-[6px] border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              {button.label}
            </button>
          ))}
        </div>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => setPromptHtml(editorRef.current?.innerHTML || "")}
          className="min-h-44 px-3 py-3 text-sm leading-6 outline-none"
          data-placeholder="Write formatted question prompt / scenario here"
        />
      </div>

      {isMcq ? (
        <section className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="font-semibold text-slate-950">MCQ Options</h4>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input name="allow_multiple_answers" type="checkbox" value="true" />
              Allow multiple correct answers
            </label>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {["A", "B", "C", "D"].map((label) => (
              <label key={label} className="grid gap-2 rounded-[8px] border border-slate-200 bg-white p-3 text-sm">
                <span className="font-medium text-slate-700">Option {label}</span>
                <input name={`option_${label}`} placeholder={`Option ${label} text`} className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm" />
                <span className="flex items-center gap-2 text-xs text-slate-600">
                  <input name="correct_options" type="checkbox" value={label} />
                  Correct answer
                </span>
              </label>
            ))}
          </div>
        </section>
      ) : null}

      {isCoding ? (
        <section className="grid gap-3 rounded-[8px] border border-slate-200 bg-slate-50 p-4">
          <h4 className="font-semibold text-slate-950">Coding Evaluation</h4>
          <div className="grid gap-3 md:grid-cols-3">
            <input name="time_limit_ms" type="number" placeholder="Time limit ms" className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm" />
            <input name="memory_limit_mb" type="number" placeholder="Memory MB" className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm" />
            <input name="compilation_attempt_limit" type="number" placeholder="Compile attempts" className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <textarea
            name="open_test_cases"
            rows={4}
            placeholder='Open test cases JSON, e.g. [{"input":"1 2","output":"3"}]'
            className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            name="hidden_test_cases"
            rows={4}
            placeholder='Hidden test cases JSON, e.g. [{"input":"large case","output":"expected"}]'
            className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm"
          />
        </section>
      ) : null}

      {(needsExpectedAnswer || isCoding) ? (
        <textarea
          name="expected_answer"
          rows={4}
          placeholder={isCoding ? "Reference solution / expected approach" : "Correct or expected answer"}
          className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm"
        />
      ) : null}

      <button className="w-fit rounded-[8px] bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
        Add Question
      </button>
    </form>
  );
}
