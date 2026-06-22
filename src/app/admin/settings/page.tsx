import { revalidatePath } from "next/cache";
import { fetchAssessmentBank, updateAssessmentSecuritySettings } from "@/lib/assessment-bank-api";
import { type AssessmentSecurityPolicy } from "@/data/assessment-bank";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseBoolean(value: FormDataEntryValue | null) {
  return value !== null;
}

function parsePositiveInt(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(String(value || "").trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function saveSecuritySettings(formData: FormData) {
  "use server";

  const assessmentBank = await fetchAssessmentBank();
  const currentSecurity = assessmentBank.assessment.security || {};

  const nextSecurity: Required<AssessmentSecurityPolicy> = {
    tab_switch_protection_enabled: parseBoolean(formData.get("tab_switch_protection_enabled")),
    max_tab_switch_events: parsePositiveInt(formData.get("max_tab_switch_events"), currentSecurity.max_tab_switch_events ?? 2),
    auto_submit_on_max_events: parseBoolean(formData.get("auto_submit_on_max_events")),
    camera_proctoring_enabled: parseBoolean(formData.get("camera_proctoring_enabled")),
    max_camera_events: parsePositiveInt(formData.get("max_camera_events"), currentSecurity.max_camera_events ?? 2),
    auto_submit_on_camera_events: parseBoolean(formData.get("auto_submit_on_camera_events")),
    copy_paste_block_enabled: parseBoolean(formData.get("copy_paste_block_enabled")),
    inspect_mode_block_enabled: parseBoolean(formData.get("inspect_mode_block_enabled")),
    restart_timer_on_login: parseBoolean(formData.get("restart_timer_on_login")),
    assessment_scoring_details_enabled: parseBoolean(formData.get("assessment_scoring_details_enabled")),
  };

  await updateAssessmentSecuritySettings(nextSecurity);
  revalidatePath("/admin/settings");
  revalidatePath("/admin/question-bank");
  revalidatePath("/admin");
}

export default async function AdminSettingsPage() {
  const assessmentBank = await fetchAssessmentBank();
  const security: AssessmentSecurityPolicy = assessmentBank.assessment.security || {};

  return (
    <div className="grid gap-6">
      <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">Admin Settings</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-950">Assessment security controls</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          These controls are admin-only. Changes are written back to the assessment bank and applied on the next session bootstrap.
        </p>
        <div className="mt-4 inline-flex rounded-[12px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
          Current assessment: {assessmentBank.assessment.title}
        </div>
      </section>

      <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
        <form action={saveSecuritySettings} className="grid gap-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <fieldset className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
              <legend className="px-1 text-sm font-semibold text-slate-950">Tab switching</legend>
              <div className="mt-3 grid gap-3">
                <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <input
                    name="tab_switch_protection_enabled"
                    type="checkbox"
                    defaultChecked={security.tab_switch_protection_enabled ?? false}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  Enable tab / window switch detection
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Max tab switch events
                  <input
                    name="max_tab_switch_events"
                    type="number"
                    min="1"
                    defaultValue={security.max_tab_switch_events ?? 2}
                    className="rounded-[8px] border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <input
                    name="auto_submit_on_max_events"
                    type="checkbox"
                    defaultChecked={security.auto_submit_on_max_events ?? false}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  Auto-submit when tab violations hit the limit
                </label>
              </div>
            </fieldset>

            <fieldset className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
              <legend className="px-1 text-sm font-semibold text-slate-950">Camera proctoring</legend>
              <div className="mt-3 grid gap-3">
                <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <input
                    name="camera_proctoring_enabled"
                    type="checkbox"
                    defaultChecked={security.camera_proctoring_enabled ?? false}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  Require camera access before the assessment starts
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Max camera events
                  <input
                    name="max_camera_events"
                    type="number"
                    min="1"
                    defaultValue={security.max_camera_events ?? 2}
                    className="rounded-[8px] border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <input
                    name="auto_submit_on_camera_events"
                    type="checkbox"
                    defaultChecked={security.auto_submit_on_camera_events ?? false}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  Auto-submit when camera violations hit the limit
                </label>
              </div>
            </fieldset>

            <fieldset className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
              <legend className="px-1 text-sm font-semibold text-slate-950">Content restrictions</legend>
              <div className="mt-3 grid gap-3">
                <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <input
                    name="copy_paste_block_enabled"
                    type="checkbox"
                    defaultChecked={security.copy_paste_block_enabled ?? false}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  Block copy, paste, cut, and select-all shortcuts
                </label>
                <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <input
                    name="inspect_mode_block_enabled"
                    type="checkbox"
                    defaultChecked={security.inspect_mode_block_enabled ?? false}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  Block inspect / devtools shortcuts and context menu
                </label>
              </div>
            </fieldset>

            <fieldset className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
              <legend className="px-1 text-sm font-semibold text-slate-950">Timer behavior</legend>
              <div className="mt-3 grid gap-3">
                <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <input
                    name="restart_timer_on_login"
                    type="checkbox"
                    defaultChecked={security.restart_timer_on_login ?? false}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  Restart the full 3-hour timer on each login
                </label>
                <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <input
                    name="assessment_scoring_details_enabled"
                    type="checkbox"
                    defaultChecked={security.assessment_scoring_details_enabled ?? true}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  Show assessment scoring details in the live assessment shell
                </label>
              </div>
            </fieldset>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <p className="text-sm leading-6 text-slate-600">
              Saving updates backend settings. The assessment runtime picks this up on the next bootstrap.
            </p>
            <button type="submit" className="rounded-[8px] bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
              Save Settings
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

