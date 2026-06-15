import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FileUp, PlusCircle } from "lucide-react";
import { StudentManagementTable } from "@/components/admin/student-management-table";
import { adminUi } from "@/lib/admin/ui";
import { cleanString, requireAdmin } from "@/lib/admin/supabase-admin";
import { supabaseService } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type StudentRecord = {
  id: string | null;
  email: string | null;
  full_name: string | null;
  roll_number: string | null;
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

type AssignmentRecord = {
  batch_id: string | null;
  student_id: string | null;
  created_at: string | null;
};

function messageParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function numberParam(value: string | string[] | undefined) {
  const text = messageParam(value);
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function redirectWithError(message: string): never {
  redirect(`/admin/students?error=${encodeURIComponent(message)}`);
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseCsvRows(input: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const nextCharacter = input[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentField += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      currentRow.push(currentField.trim());
      if (currentRow.some((cell) => cell !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
      continue;
    }

    currentField += character;
  }

  if (currentField.length || currentRow.length) {
    currentRow.push(currentField.trim());
    if (currentRow.some((cell) => cell !== "")) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function resolveBatchId(value: string | null, batchesById: Map<string, BatchRecord>, batchesByName: Map<string, BatchRecord>) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (batchesById.has(text)) return text;
  const byName = batchesByName.get(text.toLowerCase());
  return byName?.id || null;
}

async function createStudentAccountInSupabase({
  supabase,
  fullName,
  rollNumber,
  email,
  password,
  batchId,
}: {
  supabase: ReturnType<typeof supabaseService>;
  fullName: string;
  rollNumber: string;
  email: string;
  password: string;
  batchId: string | null;
}) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      roll_number: rollNumber,
      role: "student",
    },
  });

  if (error || !data.user?.id) {
    return error?.message || "Could not create student account";
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: data.user.id,
    email,
    full_name: fullName,
    roll_number: rollNumber,
    role: "student",
  });

  if (profileError) {
    return `Account created, but profile could not be saved: ${profileError.message}`;
  }

  if (batchId) {
    const { error: batchError } = await supabase.from("batch_students").insert({
      batch_id: batchId,
      student_id: data.user.id,
    });

    if (batchError) {
      return `Account created, but batch could not be assigned: ${batchError.message}`;
    }
  }

  return null;
}

async function createStudentAccount(formData: FormData) {
  "use server";

  await requireAdmin();
  const supabase = supabaseService();
  const fullName = cleanString(formData.get("full_name"));
  const rollNumber = cleanString(formData.get("roll_number")) || "";
  const email = cleanString(formData.get("email"))?.toLowerCase();
  const password = cleanString(formData.get("password"));
  const batchId = cleanString(formData.get("batch_id"));

  if (!fullName || !rollNumber || !email || !password) {
    redirectWithError("Name, roll number, email and password are required");
  }

  if (password.length < 6) {
    redirectWithError("Password must be at least 6 characters");
  }

  const errorMessage = await createStudentAccountInSupabase({
    supabase,
    fullName,
    rollNumber,
    email,
    password,
    batchId,
  });

  if (errorMessage) {
    redirectWithError(errorMessage);
  }

  revalidatePath("/admin/students");
  redirect("/admin/students?created=1");
}

async function updateStudentAccount(formData: FormData) {
  "use server";

  await requireAdmin();
  const supabase = supabaseService();
  const studentId = cleanString(formData.get("student_id"));
  const fullName = cleanString(formData.get("full_name"));
  const rollNumber = cleanString(formData.get("roll_number")) || "";
  const email = cleanString(formData.get("email"))?.toLowerCase();
  const password = cleanString(formData.get("password"));
  const batchId = cleanString(formData.get("batch_id"));

  if (!studentId || !fullName || !rollNumber || !email) {
    redirectWithError("Student ID, name, roll number and email are required");
  }

  if (password && password.length < 6) {
    redirectWithError("Password must be at least 6 characters");
  }

  const authPayload: { email: string; password?: string; user_metadata: { full_name: string; roll_number: string; role: string } } = {
    email,
    user_metadata: {
      full_name: fullName,
      roll_number: rollNumber,
      role: "student",
    },
  };
  if (password) authPayload.password = password;

  const { error: authError } = await supabase.auth.admin.updateUserById(studentId, authPayload);
  if (authError) {
    redirectWithError(authError.message);
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: studentId,
    email,
    full_name: fullName,
    roll_number: rollNumber,
    role: "student",
  });

  if (profileError) {
    redirectWithError(profileError.message);
  }

  await supabase.from("batch_students").delete().eq("student_id", studentId);
  if (batchId) {
    const { error: batchError } = await supabase.from("batch_students").insert({
      batch_id: batchId,
      student_id: studentId,
    });

    if (batchError) {
      redirectWithError(batchError.message);
    }
  }

  revalidatePath("/admin/students");
  redirect("/admin/students?updated=1");
}

async function bulkUploadStudents(formData: FormData) {
  "use server";

  await requireAdmin();
  const supabase = supabaseService();
  const file = formData.get("file");
  const defaultPassword = cleanString(formData.get("default_password"));
  const defaultBatchId = cleanString(formData.get("default_batch_id"));

  if (!(file instanceof File) || file.size === 0) {
    redirectWithError("Upload a CSV file with student rows");
  }

  if (defaultPassword && defaultPassword.length < 6) {
    redirectWithError("Fallback password must be at least 6 characters");
  }

  const rawText = await file.text();
  const rows = parseCsvRows(rawText.replace(/^\uFEFF/, ""));

  if (rows.length < 2) {
    redirectWithError("The CSV file needs a header row and at least one student row");
  }

  const headers = rows.shift()?.map(normalizeHeader) || [];
  const studentRows = rows
    .map((row) => {
      const values = new Map<string, string>();
      headers.forEach((header, index) => {
        values.set(header, row[index] || "");
      });
      return values;
    })
    .filter((values) => {
      const email = String(values.get("email") || "").trim();
      const name = String(values.get("full_name") || values.get("name") || values.get("student_name") || "").trim();
      return Boolean(email || name);
    });

  if (studentRows.length === 0) {
    redirectWithError("No usable student rows were found in the CSV file");
  }

  const { data: batchRows } = await supabase.from("batches").select("id,name,college_id,status");
  const batches = (batchRows || []) as unknown as BatchRecord[];
  const batchesById = new Map(batches.map((batch) => [String(batch.id || ""), batch]));
  const batchesByName = new Map(batches.map((batch) => [String(batch.name || "").trim().toLowerCase(), batch]));

  const uniqueEmails = Array.from(
    new Set(
      studentRows
        .map((values) => String(values.get("email") || "").trim().toLowerCase())
        .filter(Boolean),
    ),
  );

  let existingEmailSet = new Set<string>();
  if (uniqueEmails.length > 0) {
    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("email")
      .in("email", uniqueEmails);

    if (profileError) {
      redirectWithError(profileError.message);
    }

    existingEmailSet = new Set(
      ((profileRows || []) as Array<Record<string, string | null>>)
        .map((profile) => String(profile.email || "").trim().toLowerCase())
        .filter(Boolean),
    );
  }

  let imported = 0;
  let skipped = 0;
  const rowErrors: string[] = [];

  for (const [index, values] of studentRows.entries()) {
    const fullName = String(values.get("full_name") || values.get("name") || values.get("student_name") || "").trim();
    const rollNumber = String(values.get("roll_number") || values.get("roll_no") || values.get("rollnumber") || "").trim();
    const email = String(values.get("email") || "").trim().toLowerCase();
    const password = String(values.get("password") || "").trim() || defaultPassword || "";
    const batchValue = String(values.get("batch_id") || values.get("batch") || values.get("batch_name") || "").trim();
    const resolvedBatchId = resolveBatchId(batchValue || defaultBatchId || null, batchesById, batchesByName);

    if (!fullName || !email) {
      skipped += 1;
      rowErrors.push(`Row ${index + 2}: name and email are required`);
      continue;
    }

    if (!password) {
      skipped += 1;
      rowErrors.push(`Row ${index + 2}: password is required when the fallback password is empty`);
      continue;
    }

    if (password.length < 6) {
      skipped += 1;
      rowErrors.push(`Row ${index + 2}: password must be at least 6 characters`);
      continue;
    }

    if (existingEmailSet.has(email)) {
      skipped += 1;
      rowErrors.push(`Row ${index + 2}: ${email} already exists`);
      continue;
    }

    const errorMessage = await createStudentAccountInSupabase({
      supabase,
      fullName,
      rollNumber,
      email,
      password,
      batchId: resolvedBatchId,
    });

    if (errorMessage) {
      skipped += 1;
      rowErrors.push(`Row ${index + 2}: ${errorMessage}`);
      continue;
    }

    imported += 1;
    existingEmailSet.add(email);
  }

  if (imported === 0) {
    const fallbackMessage = rowErrors[0] || "No students could be imported from the CSV file";
    redirectWithError(fallbackMessage);
  }

  revalidatePath("/admin/students");
  redirect(`/admin/students?imported=${imported}&skipped=${skipped}`);
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data: studentRows }, { data: batchRows }, { data: collegeRows }, { data: assignmentRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,email,full_name,roll_number,role,created_at")
      .eq("role", "student")
      .order("created_at", { ascending: false }),
    supabase.from("batches").select("id,name,college_id,status").order("name"),
    supabase.from("colleges").select("id,name").order("name"),
    supabase.from("batch_students").select("batch_id,student_id,created_at").order("created_at", { ascending: false }),
  ]);

  const students = (studentRows || []) as unknown as StudentRecord[];
  const batches = (batchRows || []) as unknown as BatchRecord[];
  const colleges = (collegeRows || []) as unknown as CollegeRecord[];
  const assignments = (assignmentRows || []) as unknown as AssignmentRecord[];

  const collegeById = new Map(colleges.map((college) => [String(college.id || ""), college.name || ""]));
  const assignedStudentCount = new Set(assignments.map((assignment) => assignment.student_id).filter(Boolean)).size;
  const assignmentByStudentId = new Map<string, string | null>();
  assignments.forEach((assignment) => {
    if (!assignmentByStudentId.has(String(assignment.student_id || ""))) {
      assignmentByStudentId.set(String(assignment.student_id || ""), assignment.batch_id);
    }
  });

  const importedCount = numberParam(params.imported);
  const skippedCount = numberParam(params.skipped);

  return (
    <div className="grid gap-6">
      <section className={adminUi.workspaceCard}>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className={adminUi.eyebrow}>Teacher workspace</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Student creation and account management
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              Create student logins, assign batches, and keep the roster easy to scan on desktop, tablet, and mobile.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[460px] xl:grid-cols-4">
            <div className={adminUi.compactCard}>
              <p className="text-sm font-medium text-slate-500">Students</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{students.length}</p>
            </div>
            <div className={adminUi.compactCard}>
              <p className="text-sm font-medium text-slate-500">Batches</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{batches.length}</p>
            </div>
            <div className={adminUi.compactCard}>
              <p className="text-sm font-medium text-slate-500">Colleges</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{colleges.length}</p>
            </div>
            <div className={adminUi.compactCard}>
              <p className="text-sm font-medium text-slate-500">Assigned</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{assignedStudentCount}</p>
            </div>
          </div>
        </div>
      </section>

      {messageParam(params.created) ? (
        <div className="rounded-[16px] border border-[var(--status-ready-border)] bg-[var(--status-ready-bg)] px-4 py-3 text-sm font-medium text-[var(--status-ready-text)]">
          Student account created successfully.
        </div>
      ) : null}

      {messageParam(params.updated) ? (
        <div className="rounded-[16px] border border-[var(--status-ready-border)] bg-[var(--status-ready-bg)] px-4 py-3 text-sm font-medium text-[var(--status-ready-text)]">
          Student account updated successfully.
        </div>
      ) : null}

      {importedCount !== null ? (
        <div className="rounded-[16px] border border-[var(--status-ready-border)] bg-[var(--status-ready-bg)] px-4 py-3 text-sm font-medium text-[var(--status-ready-text)]">
          Imported {importedCount} student{importedCount === 1 ? "" : "s"}.
          {skippedCount !== null ? ` Skipped ${skippedCount} row${skippedCount === 1 ? "" : "s"}.` : ""}
        </div>
      ) : null}

      {messageParam(params.error) ? (
        <div className="rounded-[16px] border border-[var(--status-critical-border)] bg-[var(--status-critical-bg)] px-4 py-3 text-sm font-medium text-[var(--status-critical-text)]">
          {messageParam(params.error)}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className={adminUi.sectionCard}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={adminUi.eyebrow}>Create student</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Create student account</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Create a login for a student, save their profile name, and optionally assign a batch.
              </p>
            </div>
            <div className="rounded-[18px] bg-[var(--color-primary-50)] p-3 text-[var(--color-primary-700)]">
              <PlusCircle className="h-6 w-6" />
            </div>
          </div>

          <form action={createStudentAccount} className="mt-6 grid gap-4">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Full name</span>
              <input
                name="full_name"
                required
                className="h-11 rounded-[12px] border border-slate-300 px-3 text-slate-950 outline-none transition focus:border-[var(--color-primary-400)] focus:ring-4 focus:ring-[var(--color-primary-100)]"
                placeholder="Student name"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Roll number</span>
              <input
                name="roll_number"
                required
                className="h-11 rounded-[12px] border border-slate-300 px-3 text-slate-950 outline-none transition focus:border-[var(--color-primary-400)] focus:ring-4 focus:ring-[var(--color-primary-100)]"
                placeholder="Student roll number"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Email</span>
              <input
                name="email"
                type="email"
                required
                className="h-11 rounded-[12px] border border-slate-300 px-3 text-slate-950 outline-none transition focus:border-[var(--color-primary-400)] focus:ring-4 focus:ring-[var(--color-primary-100)]"
                placeholder="student@example.com"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Password</span>
              <input
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                className="h-11 rounded-[12px] border border-slate-300 px-3 text-slate-950 outline-none transition focus:border-[var(--color-primary-400)] focus:ring-4 focus:ring-[var(--color-primary-100)]"
                placeholder="Temporary password"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Batch</span>
              <select
                name="batch_id"
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
            <button className={`${adminUi.primaryButton} mt-2 w-full`} type="submit">
              Create student
            </button>
          </form>
        </section>

        <section className={adminUi.sectionCard}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={adminUi.eyebrow}>Bulk upload</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Import students from CSV</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Upload a CSV to create multiple accounts in one pass. Use one row per student.
              </p>
            </div>
            <div className="rounded-[18px] bg-[var(--color-primary-50)] p-3 text-[var(--color-primary-700)]">
              <FileUp className="h-6 w-6" />
            </div>
          </div>

          <div className="mt-5 rounded-[20px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] p-4 text-sm text-slate-700">
            <p className="font-medium text-slate-900">CSV columns</p>
            <p className="mt-2 leading-6">
              Required: <span className="font-mono">full_name</span>, <span className="font-mono">email</span>. Optional:
              <span className="font-mono"> roll_number</span>,
              <span className="font-mono"> password</span>, <span className="font-mono">batch</span>, or{" "}
              <span className="font-mono">batch_id</span>.
            </p>
            <p className="mt-2 leading-6">
              If a row does not include a password, the fallback password below will be used.
            </p>
          </div>

          <form action={bulkUploadStudents} className="mt-6 grid gap-4">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">CSV file</span>
              <input
                name="file"
                type="file"
                accept=".csv,text/csv"
                required
                className="block w-full rounded-[12px] border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none file:mr-4 file:rounded-[10px] file:border-0 file:bg-[var(--color-primary-600)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[var(--color-primary-700)] focus:border-[var(--color-primary-400)] focus:ring-4 focus:ring-[var(--color-primary-100)]"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Fallback password</span>
              <input
                name="default_password"
                type="password"
                minLength={6}
                autoComplete="new-password"
                placeholder="Used when a row does not include a password"
                className="h-11 rounded-[12px] border border-slate-300 px-3 text-slate-950 outline-none transition focus:border-[var(--color-primary-400)] focus:ring-4 focus:ring-[var(--color-primary-100)]"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Default batch</span>
              <select
                name="default_batch_id"
                className="h-11 rounded-[12px] border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-[var(--color-primary-400)] focus:ring-4 focus:ring-[var(--color-primary-100)]"
              >
                <option value="">No default batch</option>
                {batches.map((batch) => (
                  <option key={String(batch.id || "")} value={String(batch.id || "")}>
                    {batch.name}
                    {batch.college_id ? ` - ${collegeById.get(String(batch.college_id || "")) || "College"}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <button className={`${adminUi.primaryButton} mt-2 w-full`} type="submit">
              Upload students
            </button>
          </form>
        </section>
      </div>

      <StudentManagementTable
        students={students}
        batches={batches}
        colleges={colleges}
        assignmentByStudentId={Object.fromEntries(assignmentByStudentId.entries())}
        updateStudentAccount={updateStudentAccount}
      />
    </div>
  );
}
