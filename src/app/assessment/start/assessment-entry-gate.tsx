"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Loader2, ShieldAlert, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

type AssessmentEntryGateProps = {
  assessmentHref: string;
  locked: boolean;
  lockedLabel: string;
  lockedDescription: string;
  lockedActionHref: string;
  lockedActionLabel: string;
};

const consentRules = [
  "My screen is being recorded during the assessment.",
  "The first tab switch or camera warning will trigger a warning, and the next one will disqualify me.",
  "Once submitted or disqualified, the assessment cannot be retaken.",
];

export function AssessmentEntryGate({
  assessmentHref,
  locked,
  lockedLabel,
  lockedDescription,
  lockedActionHref,
  lockedActionLabel,
}: AssessmentEntryGateProps) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [isEntering, setIsEntering] = useState(false);

  if (locked) {
    return (
      <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2 font-semibold text-slate-950">
          <ShieldAlert size={18} />
          {lockedLabel}
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-700">{lockedDescription}</p>
        <Link
          href={lockedActionHref}
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {lockedActionLabel}
          <ArrowRight size={18} />
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex items-center gap-2 font-semibold text-emerald-900">
        <Sparkles size={18} />
        Assessment entry agreement
      </div>
      <p className="mt-3 text-sm leading-6 text-emerald-900">
        Read and accept the rules below. You can enter the assessment only after ticking the agreement.
      </p>
      <ul className="mt-4 space-y-3 text-sm leading-6 text-emerald-900">
        {consentRules.map((rule) => (
          <li key={rule} className="flex gap-2">
            <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-800" size={16} />
            <span>{rule}</span>
          </li>
        ))}
      </ul>
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-[8px] border border-emerald-200 bg-white px-3 py-3 text-sm leading-6 text-slate-700">
        <input
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
          type="checkbox"
        />
        <span>
          I understand that my screen may be recorded, the first warning is only a warning, and the next
          integrity violation can disqualify me from this assessment.
        </span>
      </label>
      <button
        type="button"
        disabled={!agreed}
        onClick={() => {
          setIsEntering(true);
          router.push(assessmentHref);
        }}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isEntering ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Entering...
          </>
        ) : (
          <>
            Enter Assessment
            <ArrowRight size={18} />
          </>
        )}
      </button>
    </div>
  );
}
