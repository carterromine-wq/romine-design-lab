import type { Lesson } from "../course-data";

export type LessonProgress = {
  read: boolean;
  watched: boolean;
  verifiedSeconds: number;
  videoDuration: number;
  videoOverride?: { reason: string; at: string; teacherId: string };
  tasks: Record<string, boolean>;
  quizAnswer: number | null;
  reflection: string;
  projectUrl: string;
  notes: string;
  completed: boolean;
  currentStep: number;
  updatedAt: string | null;
  revision: number;
};

export type ProgressPatch = Partial<Omit<LessonProgress, "updatedAt" | "revision" | "watched" | "verifiedSeconds" | "videoDuration" | "videoOverride">>;

export type ProgressRecord = {
  lessons: Record<string, LessonProgress>;
  lastLessonId: string | null;
  lastStep: number;
  updatedAt: string | null;
};

export function emptyProgress(): LessonProgress {
  return {
    read: false,
    watched: false,
    verifiedSeconds: 0,
    videoDuration: 0,
    tasks: {},
    quizAnswer: null,
    reflection: "",
    projectUrl: "",
    notes: "",
    completed: false,
    currentStep: 0,
    updatedAt: null,
    revision: 0,
  };
}

export function emptyProgressRecord(): ProgressRecord {
  return { lessons: {}, lastLessonId: null, lastStep: 0, updatedAt: null };
}

export function isFigmaProjectUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "figma.com" || url.hostname === "www.figma.com") &&
      !url.username &&
      !url.password &&
      !url.port &&
      /^\/(design|file|proto)\/[A-Za-z0-9_-]+(?:\/|$)/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

/** Human-readable requirements shared by the UI and the write endpoint. */
export function completionIssues(lesson: Lesson, progress: LessonProgress): string[] {
  const issues: string[] = [];
  if (!progress.read) issues.push("Read the lesson and mark Learn complete.");
  if (!progress.watched) issues.push("Watch the full tutorial to unlock Build.");
  if (!lesson.tasks.every((task) => progress.tasks[task.id] === true)) {
    issues.push("Finish and check off every Build task.");
  }
  if (progress.quizAnswer !== lesson.quiz.correctIndex) {
    issues.push("Answer the knowledge check correctly.");
  }
  if (progress.reflection.trim().length < 15) {
    issues.push("Write a reflection of at least 15 characters.");
  }
  if (!isFigmaProjectUrl(progress.projectUrl)) {
    issues.push("Add the link to your own Figma design or prototype.");
  }
  return issues;
}

export class ProgressValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ProgressValidationError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate every writable field. Unknown keys cannot set another student's ID. */
export function validateProgressPatch(lesson: Lesson, input: unknown): ProgressPatch {
  if (!isRecord(input)) throw new ProgressValidationError("A progress patch is required.");
  const allowed = new Set([
    "read", "tasks", "quizAnswer", "reflection", "projectUrl",
    "notes", "completed", "currentStep",
  ]);
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    throw new ProgressValidationError("The progress patch contains an unsupported field.");
  }
  const patch: ProgressPatch = {};
  for (const key of ["read", "completed"] as const) {
    if (Object.hasOwn(input, key)) {
      if (typeof input[key] !== "boolean") {
        throw new ProgressValidationError(`${key} must be true or false.`);
      }
      patch[key] = input[key];
      if (input[key] !== true) throw new ProgressValidationError("Completed checkpoints cannot be unchecked.");
    }
  }
  if (Object.hasOwn(input, "currentStep")) {
    if (!Number.isInteger(input.currentStep) || (input.currentStep as number) < 0 || (input.currentStep as number) > 3) {
      throw new ProgressValidationError("The lesson step must be from 0 to 3.");
    }
    patch.currentStep = input.currentStep as number;
  }
  if (Object.hasOwn(input, "quizAnswer")) {
    if (input.quizAnswer !== null && (
      !Number.isInteger(input.quizAnswer) ||
      (input.quizAnswer as number) < 0 ||
      (input.quizAnswer as number) >= lesson.quiz.options.length
    )) {
      throw new ProgressValidationError("Choose one of the knowledge-check answers.");
    }
    patch.quizAnswer = input.quizAnswer as number | null;
  }
  for (const key of ["notes", "reflection"] as const) {
    if (Object.hasOwn(input, key)) {
      if (typeof input[key] !== "string" || input[key].length > 2000) {
        throw new ProgressValidationError(`${key} must be text of 2,000 characters or fewer.`);
      }
      patch[key] = input[key];
    }
  }
  if (Object.hasOwn(input, "projectUrl")) {
    if (typeof input.projectUrl !== "string" || input.projectUrl.length > 2048) {
      throw new ProgressValidationError("The Figma link is too long or is not text.");
    }
    const value = input.projectUrl.trim();
    if (value && !isFigmaProjectUrl(value)) {
      throw new ProgressValidationError("Paste a complete https://www.figma.com/design/, /file/, or /proto/ link to your work.");
    }
    patch.projectUrl = value;
  }
  if (Object.hasOwn(input, "tasks")) {
    if (!isRecord(input.tasks)) throw new ProgressValidationError("Task progress must be a checklist.");
    const validTaskIds = new Set(lesson.tasks.map((task) => task.id));
    patch.tasks = {};
    for (const [key, value] of Object.entries(input.tasks)) {
      if (!validTaskIds.has(key) || value !== true) {
        throw new ProgressValidationError("Task progress contains an invalid task or value.");
      }
      patch.tasks[key] = value;
    }
  }
  if (!Object.keys(patch).length) throw new ProgressValidationError("Choose something to save first.");
  return patch;
}

/** Patch only submitted fields; untouched tasks and work from other tabs survive. */
export function mergeProgress(
  lesson: Lesson,
  current: LessonProgress,
  patch: ProgressPatch,
  updatedAt: string,
): LessonProgress {
  const next: LessonProgress = {
    ...current,
    ...patch,
    tasks: { ...current.tasks, ...(patch.tasks ?? {}) },
    updatedAt,
  };
  const issues = completionIssues(lesson, next);
  if (patch.completed === true && issues.length) {
    throw new ProgressValidationError(issues.join(" "), 422);
  }
  if (current.completed && issues.length) {
    throw new ProgressValidationError("Keep the completed lesson requirements in place. You can still edit your notes or valid project link.", 409);
  }
  return next;
}

/** All prior lessons must be complete, even when a URL or API call is entered directly. */
export function lessonUnlocked(allLessons: Lesson[], record: ProgressRecord, lessonId: string): boolean {
  const index = allLessons.findIndex(lesson => lesson.id === lessonId);
  return index >= 0 && allLessons.slice(0, index).every(lesson => record.lessons[lesson.id]?.completed === true);
}

export function firstUnfinished(allLessons: Lesson[], record: ProgressRecord): Lesson | undefined {
  return allLessons.find(lesson => !record.lessons[lesson.id]?.completed);
}

export function maximumStep(lesson: Lesson, progress: LessonProgress): number {
  if (!progress.read) return 0;
  if (!progress.watched) return 1;
  if (!lesson.tasks.every(task => progress.tasks[task.id])) return 2;
  return 3;
}

/** Gates use the existing state so one forged request cannot complete every stage. */
export function assertSequentialPatch(lesson: Lesson, current: LessonProgress, patch: ProgressPatch): void {
  if (patch.tasks && Object.keys(patch.tasks).length) {
    if (!current.read || !current.watched) throw new ProgressValidationError("Finish Learn and Watch before starting Build.", 403);
    const newTasks = lesson.tasks.filter(task => patch.tasks?.[task.id] && !current.tasks[task.id]);
    if (newTasks.length > 1) throw new ProgressValidationError("Complete one Build task at a time.", 403);
    for (const task of newTasks) {
      const index = lesson.tasks.findIndex(item => item.id === task.id);
      if (!lesson.tasks.slice(0, index).every(item => current.tasks[item.id])) {
        throw new ProgressValidationError("Complete the previous Build task first.", 403);
      }
    }
  }
  if (["quizAnswer", "reflection", "projectUrl", "completed"].some(key => Object.hasOwn(patch, key)) && maximumStep(lesson, current) < 3) {
    throw new ProgressValidationError("Complete every Build task before opening Check.", 403);
  }
  const after = { ...current, ...patch, tasks: { ...current.tasks, ...patch.tasks } };
  if (patch.currentStep !== undefined && patch.currentStep > maximumStep(lesson, after)) {
    throw new ProgressValidationError("Complete the current step before opening the next one.", 403);
  }
}

/** Stored data is server-generated; fall back safely if a row is unreadable. */
export function decodeStoredProgress(data: string, updatedAt: string): LessonProgress {
  try {
    const parsed = JSON.parse(data);
    if (!isRecord(parsed)) return { ...emptyProgress(), updatedAt };
    return { ...emptyProgress(), ...parsed, updatedAt } as LessonProgress;
  } catch {
    return { ...emptyProgress(), updatedAt };
  }
}
