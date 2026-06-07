"use client";

import type { AssessmentQuestion } from "@/data/assessment-bank";

type McqPanelProps = {
  question: AssessmentQuestion;
  selected: string[];
  onChange: (selected: string[]) => void;
};

export function McqPanel({ question, selected, onChange }: McqPanelProps) {
  const options = question.options || [];
  const multiple = Boolean(question.allow_multiple_answers);

  function toggle(label: string) {
    if (!multiple) {
      onChange([label]);
      return;
    }

    onChange(selected.includes(label) ? selected.filter((item) => item !== label) : [...selected, label]);
  }

  return (
    <div className="grid gap-3">
      {options.map((option) => {
        const checked = selected.includes(option.label);
        return (
          <label
            key={option.label}
            className={`flex cursor-pointer gap-3 rounded-[8px] border p-4 text-sm transition ${
              checked ? "border-emerald-300 bg-emerald-50 text-emerald-950" : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
            }`}
          >
            <input
              type={multiple ? "checkbox" : "radio"}
              name={question.id}
              checked={checked}
              onChange={() => toggle(option.label)}
              className="mt-1"
            />
            <span className="font-semibold">{option.label}</span>
            <span className="leading-6">{option.text}</span>
          </label>
        );
      })}
    </div>
  );
}
