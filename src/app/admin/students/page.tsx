import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cleanString, requireAdmin } from "@/lib/admin/supabase-admin";
import { supabaseService } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function messageParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function displayStudentName(student: Record<string, string | null>) {
  const fullName = String(student.full_name || "").trim();
  if (fullName) return fullName;
  const email = String(student.email || "").trim();
  if (email.includes("@")) return email.split("@")[0];
  return "Unnamed";
}

function redirectWithError(message: string): never {
  redirect(`/admin/students?error=${encodeURIComponent(message)}`);
}

async function createStudentAccount(formData: FormData) {
  "use server";

  await requireAdmin();
  const supabase = supabaseService();
  const fullName = cleanString(formData.get("full_name"));
  const email = cleanString(formData.get("email"))?.toLowerCase();
  const password = cleanString(formData.get("password"));
  const batchId = cleanString(formData.get("batch_id"));

  if (!fullName || !email || !password) {
    redirectWithError("Name, email and password are required");
  }

  if (password.length < 6) {
    redirectWithError("Password must be at least 6 characters");
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: "student",
    },
  });

  if (error || !data.user?.id) {
    redirectWithError(error?.message || "Could not create student account");
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: data.user.id,
    email,
    full_name: fullName,
    role: "student",
  });

  if (profileError) {
    redirectWithError(`Account created, but profile could not be saved: ${profileError.message}`);
  }

  if (batchId) {
    const { error: batchError } = await supabase.from("batch_students").insert({
      batch_id: batchId,
      student_id: data.user.id,
    });

    if (batchError) {
      redirectWithError(`Account created, but batch could not be assigned: ${batchError.message}`);
    }
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
  const email = cleanString(formData.get("email"))?.toLowerCase();
  const password = cleanString(formData.get("password"));
  const batchId = cleanString(formData.get("batch_id"));

  if (!studentId || !fullName || !email) {
    redirectWithError("Student ID, name and email are required");
  }

  if (password && password.length < 6) {
    redirectWithError("Password must be at least 6 characters");
  }

  const authPayload: { email: string; password?: string; user_metadata: { full_name: string; role: string } } = {
    email,
    user_metadata: {
      full_name: fullName,
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
      .select("id,email,full_name,role,created_at")
      .eq("role", "student")
      .order("created_at", { ascending: false }),
    supabase.from("batches").select("id,name,college_id,status").order("name"),
    supabase.from("colleges").select("id,name").order("name"),
    supabase.from("batch_students").select("batch_id,student_id,created_at").order("created_at", { ascending: false }),
  ]);

  const students = (studentRows || []) as unknown as Array<Record<string, string | null>>;
  const batches = (batchRows || []) as unknown as Array<Record<string, string | null>>;
  const colleges = (collegeRows || []) as unknown as Array<Record<string, string | null>>;
  const assignments = (assignmentRows || []) as unknown as Array<Record<string, string | null>>;
  const collegeById = new Map(colleges.map((college) => [college.id, college.name]));
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));
  const assignmentByStudentId = new Map<string | null, string | null>();
  assignments.forEach((assignment) => {
    if (!assignmentByStudentId.has(assignment.student_id)) {
      assignmentByStudentId.set(assignment.student_id, assignment.batch_id);
    }
  });

  return (
    <div className="grid gap-6">
      <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-950">Registered Students</h2>
        <p className="mt-2 text-sm text-slate-600">
          Students are read from <span className="font-mono">profiles</span>. Assign batches here; each batch is connected to a college.
        </p>
      </section>

      {messageParam(params.created) ? (
        <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Student account created successfully.
        </div>
      ) : null}

      {messageParam(params.updated) ? (
        <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Student account updated successfully.
        </div>
      ) : null}

      {messageParam(params.error) ? (
        <div className="rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {messageParam(params.error)}
        </div>
      ) : null}

      <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h3 className="text-lg font-semibold text-slate-950">Create Student Account</h3>
          <p className="mt-1 text-sm text-slate-600">
            Create a login for a student, save their profile name, and optionally assign a batch.
          </p>
        </div>
        <form action={createStudentAccount} className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Full name</span>
            <input
              name="full_name"
              required
              className="h-10 rounded-[8px] border border-slate-300 px-3 text-slate-950"
              placeholder="Student name"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Email</span>
            <input
              name="email"
              type="email"
              required
              className="h-10 rounded-[8px] border border-slate-300 px-3 text-slate-950"
              placeholder="student@example.com"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Password</span>
            <input
              name="password"
              type="text"
              required
              minLength={6}
              className="h-10 rounded-[8px] border border-slate-300 px-3 text-slate-950"
              placeholder="Temporary password"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Batch</span>
            <select name="batch_id" className="h-10 rounded-[8px] border border-slate-300 px-3 text-sm">
              <option value="">No batch</option>
              {batches.map((batch) => (
                <option key={String(batch.id)} value={String(batch.id)}>
                  {batch.name}
                  {batch.college_id ? ` - ${collegeById.get(batch.college_id) || "College"}` : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button className="h-10 rounded-[8px] bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800">
              Create
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Batch</th>
                <th className="px-4 py-3 font-medium">College</th>
                <th className="px-4 py-3 font-medium">Edit Account</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((student) => {
                const assignedBatchId = assignmentByStudentId.get(student.id) || "";
                const assignedBatch = batchById.get(assignedBatchId);
                const collegeName = assignedBatch ? collegeById.get(assignedBatch.college_id) : null;

                return (
                  <tr key={String(student.id)} className="align-top">
                    <td className="px-4 py-3 font-medium text-slate-950">
                      {displayStudentName(student)}
                      <p className="mt-1 font-mono text-[11px] font-normal text-slate-400">{student.id}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{student.email}</td>
                    <td className="px-4 py-3 text-slate-600">{assignedBatch?.name || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{collegeName || "-"}</td>
                    <td className="px-4 py-3">
                      <form action={updateStudentAccount} className="grid gap-2 xl:grid-cols-[180px_220px_180px_220px_auto]">
                        <input type="hidden" name="student_id" value={String(student.id)} />
                        <input
                          name="full_name"
                          defaultValue={String(student.full_name || "")}
                          placeholder="Full name"
                          className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm"
                          required
                        />
                        <input
                          name="email"
                          type="email"
                          defaultValue={String(student.email || "")}
                          placeholder="Email"
                          className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm"
                          required
                        />
                        <input
                          name="password"
                          type="text"
                          placeholder="New password optional"
                          className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm"
                          minLength={6}
                        />
                        <select
                          name="batch_id"
                          defaultValue={String(assignedBatchId)}
                          className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm"
                        >
                          <option value="">No batch</option>
                          {batches.map((batch) => (
                            <option key={String(batch.id)} value={String(batch.id)}>
                              {batch.name}
                              {batch.college_id ? ` - ${collegeById.get(batch.college_id) || "College"}` : ""}
                            </option>
                          ))}
                        </select>
                        <button className="rounded-[8px] bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
                          Update
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {students.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>No registered students yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
