"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, CalendarClock, Mail, PencilLine, Search, School2, Users, X } from "lucide-react";
import { adminUi } from "@/lib/admin/ui";

type StudentRecord = {
  id: string | null;
  email: string | null;
  full_name: string | null;
  created_at: string | null;
};

type BatchRecord = {
  id: string | null;
  name: string | null;
  college_id: string | null;
  status: string | null;
};

type CollegeRecord = {
  id: string | null;
  name: string | null;
};

type StudentManagementTableProps = {
  students: StudentRecord[];
  batches: BatchRecord[];
  colleges: CollegeRecord[];
  assignmentByStudentId: Record<string, string | null>;
  updateStudentAccount: (formData: FormData) => void | Promise<void>;
};

function displayStudentName(student: StudentRecord) {
  const fullName = String(student.full_name || "").trim();
  if (fullName) return fullName;
  const email = String(student.email || "").trim();
  if (email.includes("@")) return email.split("@")[0];
  return "Unnamed";
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function StudentManagementTable({
  students,
  batches,
  colleges,
  assignmentByStudentId,
  updateStudentAccount,
}: StudentManagementTableProps) {
  const [query, setQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const batchById = useMemo(() => new Map(batches.map((batch) => [String(batch.id || ""), batch])), [batches]);
  const collegeById = useMemo(() => new Map(colleges.map((college) => [String(college.id || ""), college.name || ""])), [colleges]);
  const selectedStudent = useMemo(
    () => students.find((student) => String(student.id || "") === selectedStudentId) || null,
    [selectedStudentId, students],
  );

  useEffect(() => {
    if (!selectedStudentId) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedStudentId(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedStudentId]);

  useEffect(() => {
    if (!selectedStudentId) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedStudentId]);

  const filteredStudents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return students;

    return students.filter((student) => {
      const studentId = String(student.id || "");
      const assignedBatchId = assignmentByStudentId[studentId] || "";
      const assignedBatch = batchById.get(assignedBatchId);
      const collegeName = assignedBatch?.college_id ? collegeById.get(String(assignedBatch.college_id || "")) || "" : "";
      return [
        displayStudentName(student),
        student.email || "",
        assignedBatch?.name || "",
        collegeName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [assignmentByStudentId, batchById, collegeById, query, students]);

  const assignedCount = useMemo(
    () => new Set(Object.values(assignmentByStudentId).filter(Boolean)).size,
    [assignmentByStudentId],
  );

  const selectedStudentIdText = selectedStudent ? String(selectedStudent.id || "") : "";
  const selectedBatchId = selectedStudentIdText ? assignmentByStudentId[selectedStudentIdText] || "" : "";
  const selectedBatch = selectedBatchId ? batchById.get(selectedBatchId) || null : null;
  const selectedCollegeName = selectedBatch?.college_id ? collegeById.get(String(selectedBatch.college_id || "")) || "" : "";

  return (
    <>
      <section className={adminUi.sectionCard}>
        <div className="flex flex-col gap-4 border-b border-[var(--color-border-subtle)] pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <p className={adminUi.eyebrow}>Registered students</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Compact roster with modal editing
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The roster stays readable because all edit fields live inside a modal instead of stretching each row.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className={adminUi.softCard}>
              <div className="flex items-center gap-3">
                <div className="rounded-[14px] bg-[var(--color-primary-50)] p-2 text-[var(--color-primary-700)]">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Visible students</p>
                  <p className="text-2xl font-semibold text-slate-950">{filteredStudents.length}</p>
                </div>
              </div>
            </div>
            <div className={adminUi.softCard}>
              <div className="flex items-center gap-3">
                <div className="rounded-[14px] bg-[var(--color-primary-50)] p-2 text-[var(--color-primary-700)]">
                  <School2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Assigned batches</p>
                  <p className="text-2xl font-semibold text-slate-950">{assignedCount}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by student name, email, batch, or college"
              className="h-12 w-full rounded-[14px] border border-[var(--color-border-subtle)] bg-white pl-11 pr-4 text-sm text-slate-950 outline-none transition focus:border-[var(--color-primary-400)] focus:ring-4 focus:ring-[var(--color-primary-100)]"
            />
          </label>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-4 py-2 text-sm text-slate-600">
            Showing <span className="font-semibold text-slate-950">{filteredStudents.length}</span> of{" "}
            <span className="font-semibold text-slate-950">{students.length}</span>
          </div>
        </div>

        <div className="mt-5 hidden overflow-hidden rounded-[20px] border border-[var(--color-border-subtle)] bg-white md:block">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[26%]" />
              <col className="w-[16%]" />
              <col className="w-[12%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead className="bg-[var(--color-bg-muted)] text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Batch</th>
                <th className="px-4 py-3 font-medium">College</th>
                <th className="px-4 py-3 font-medium">Added</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {filteredStudents.map((student) => {
                const studentId = String(student.id || "");
                const assignedBatchId = assignmentByStudentId[studentId] || "";
                const assignedBatch = assignedBatchId ? batchById.get(assignedBatchId) || null : null;
                const collegeName = assignedBatch?.college_id ? collegeById.get(String(assignedBatch.college_id || "")) || "" : "";

                return (
                  <tr key={studentId} className="align-top">
                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-950">{displayStudentName(student)}</p>
                      <p className="mt-1 truncate text-[11px] font-mono text-slate-400" title={studentId}>
                        {studentId}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="block truncate text-slate-600" title={student.email || ""}>
                        {student.email || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <p className="font-medium text-slate-700">{assignedBatch?.name || "Unassigned"}</p>
                        <span className="inline-flex rounded-full bg-[var(--color-bg-muted)] px-2.5 py-1 text-[11px] font-medium text-slate-600">
                          {assignedBatch ? "Batch linked" : "No batch"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{collegeName || "-"}</td>
                    <td className="px-4 py-4 text-slate-600">{formatDateTime(student.created_at)}</td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedStudentId(studentId)}
                        className={adminUi.secondaryButton}
                      >
                        <PencilLine className="h-4 w-4" />
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredStudents.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-slate-500" colSpan={6}>
                    No students match the current search.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-5 grid gap-3 md:hidden">
          {filteredStudents.map((student) => {
            const studentId = String(student.id || "");
            const assignedBatchId = assignmentByStudentId[studentId] || "";
            const assignedBatch = assignedBatchId ? batchById.get(assignedBatchId) || null : null;
            const collegeName = assignedBatch?.college_id ? collegeById.get(String(assignedBatch.college_id || "")) || "" : "";

            return (
              <article key={studentId} className="rounded-[18px] border border-[var(--color-border-subtle)] bg-white p-4 shadow-[var(--shadow-card)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-slate-950">{displayStudentName(student)}</p>
                    <p className="mt-1 text-xs font-mono text-slate-400">{studentId}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedStudentId(studentId)}
                    className={adminUi.secondaryButton}
                  >
                    <PencilLine className="h-4 w-4" />
                    Edit
                  </button>
                </div>

                <div className="mt-4 grid gap-3 text-sm">
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-4 w-4 text-[var(--color-primary-700)]" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Email</p>
                      <p className="text-slate-700">{student.email || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Building2 className="mt-0.5 h-4 w-4 text-[var(--color-primary-700)]" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Batch</p>
                      <p className="text-slate-700">{assignedBatch?.name || "Unassigned"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <School2 className="mt-0.5 h-4 w-4 text-[var(--color-primary-700)]" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">College</p>
                      <p className="text-slate-700">{collegeName || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CalendarClock className="mt-0.5 h-4 w-4 text-[var(--color-primary-700)]" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Added</p>
                      <p className="text-slate-700">{formatDateTime(student.created_at)}</p>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}

          {filteredStudents.length === 0 ? (
            <div className="rounded-[18px] border border-[var(--color-border-subtle)] bg-white p-5 text-sm text-slate-500">
              No students match the current search.
            </div>
          ) : null}
        </div>
      </section>

      {selectedStudent ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={() => setSelectedStudentId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-edit-title"
            className="w-full max-w-2xl rounded-[24px] border border-[var(--color-border-subtle)] bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.25)] sm:p-6"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border-subtle)] pb-4">
              <div>
                <p className={adminUi.eyebrow}>Edit student</p>
                <h4 id="student-edit-title" className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  Update student account
                </h4>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Keep the student account current without stretching the main roster.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentId(null)}
                className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
                aria-label="Close edit modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-4 rounded-[20px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] p-4 text-sm text-slate-700 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Current batch</p>
                <p className="mt-1 font-medium text-slate-950">{selectedBatch?.name || "Unassigned"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Current college</p>
                <p className="mt-1 font-medium text-slate-950">{selectedCollegeName || "-"}</p>
              </div>
            </div>

            <form action={updateStudentAccount} className="mt-5 grid gap-4">
              <input type="hidden" name="student_id" value={selectedStudentIdText} />

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-slate-700">Full name</span>
                  <input
                    name="full_name"
                    required
                    defaultValue={selectedStudent.full_name || ""}
                    className="h-11 rounded-[12px] border border-slate-300 px-3 text-slate-950 outline-none transition focus:border-[var(--color-primary-400)] focus:ring-4 focus:ring-[var(--color-primary-100)]"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-slate-700">Email</span>
                  <input
                    name="email"
                    type="email"
                    required
                    defaultValue={selectedStudent.email || ""}
                    className="h-11 rounded-[12px] border border-slate-300 px-3 text-slate-950 outline-none transition focus:border-[var(--color-primary-400)] focus:ring-4 focus:ring-[var(--color-primary-100)]"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-slate-700">New password</span>
                  <input
                    name="password"
                    type="password"
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="Leave blank to keep the current password"
                    className="h-11 rounded-[12px] border border-slate-300 px-3 text-slate-950 outline-none transition focus:border-[var(--color-primary-400)] focus:ring-4 focus:ring-[var(--color-primary-100)]"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-slate-700">Batch</span>
                  <select
                    name="batch_id"
                    defaultValue={selectedBatchId}
                    className="h-11 rounded-[12px] border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-[var(--color-primary-400)] focus:ring-4 focus:ring-[var(--color-primary-100)]"
                  >
                    <option value="">No batch</option>
                    {batches.map((batch) => (
                      <option key={String(batch.id || "")} value={String(batch.id || "")}>
                        {batch.name}
                        {batch.college_id ? ` - ${collegeById.get(String(batch.college_id || "")) || "College"}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-col gap-3 border-t border-[var(--color-border-subtle)] pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setSelectedStudentId(null)} className={adminUi.secondaryButton}>
                  Cancel
                </button>
                <button type="submit" className={adminUi.primaryButton}>
                  <PencilLine className="h-4 w-4" />
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
