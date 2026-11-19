// Prompt builders. Every prompt is tailored from the user's profile, which the
// server reads from Firestore, so a client can't claim a different role.

export type Role = "student" | "resident" | "practitioner";

export interface Profile {
  role: Role;
  displayName?: string;
  university?: string; // students and residents
  yearOfStudy?: number; // students (1-7)
  specialty?: string; // residents and practitioners
  pgyYear?: number; // residents (1-8)
  country?: string;
}

export function audience(p: Profile): string {
  const where = p.university ? ` at ${p.university}` : "";
  const country = p.country ? ` in ${p.country}` : "";
  switch (p.role) {
    case "student":
      return `a year-${p.yearOfStudy ?? 1} medical student${where}${country}`;
    case "resident":
      return `a PGY-${p.pgyYear ?? 1} ${p.specialty ?? ""} resident${where}${country}`.replace(/\s+/g, " ");
    case "practitioner":
      return `a practicing ${p.specialty ?? "medical"} clinician${country}`;
  }
}

const SAFETY_STUDENT =
  "If the user asks for advice about a real patient or their own health, remind them you are a study tool and that a supervising clinician must make care decisions.";

const SAFETY_PRACTITIONER =
  "You support, and never replace, the clinician's judgment. Remind the user not to enter names or other identifying patient details if they do. For drug doses, give typical adult dosing with the key adjustments (renal, hepatic, pediatric, pregnancy) and tell them to confirm against their local formulary.";

export function tutorSystem(p: Profile, opts: { subject?: string; socratic?: boolean }): string {
  const focus = opts.subject && opts.subject !== "Any" ? `Focus: ${opts.subject}.` : "";
  if (p.role === "practitioner") {
    return `You are Pocket Attending, a clinical reference assistant for ${audience(p)}. ${focus}
Answer like a knowledgeable colleague: lead with the bottom line, then the supporting detail. Base answers on current major guidelines and high-quality evidence, naming the guideline body and year (for example "ESC 2023") when you rely on one. Never invent citations; if you are unsure of a source or the evidence is mixed, say so plainly.
Format in Markdown with short sections, bullet lists, and tables for comparisons. Give lab values and doses with units.
${SAFETY_PRACTITIONER}`;
  }
  const exam =
    p.role === "resident"
      ? `Pitch it at board-exam and in-training-exam level for ${p.specialty ?? "their specialty"}.`
      : "Pitch it at the level of their year of study.";
  const style = opts.socratic
    ? "SOCRATIC MODE: do not give the answer outright. Ask one guiding question at a time, build on the reply, and confirm or correct gently. Give the full explanation only if the user asks for it or is still stuck after three attempts."
    : "End every answer with a **High-yield** list of 2-4 bullets, then one short check-your-understanding question.";
  return `You are Pocket Attending, a rigorous, encouraging medical educator tutoring ${audience(p)}. ${focus} ${exam}
Teach from mechanism to clinical relevance. Be accurate and consistent with standard references and current major guidelines; say so when guidelines differ or evidence is uncertain.
Format in Markdown: short paragraphs, **bold** key terms, bullet lists, and a table when comparing things. Give lab values with units. Keep answers under about 350 words unless the user asks for depth.
${style}
${SAFETY_STUDENT}`;
}

export function caseSystem(p: Profile, subject?: string): string {
  const specialty =
    subject && subject !== "Any"
      ? subject
      : p.role === "student"
        ? "choose a common, high-yield presentation from any specialty"
        : `${p.specialty ?? "general medicine"}`;
  const depth =
    p.role === "student"
      ? "Keep the case at a level suitable for their year."
      : "Make the case realistically complex for their level: comorbidities, competing priorities, and management decisions, not only diagnosis.";
  return `Run an interactive clinical case simulation for ${audience(p)}. Specialty: ${specialty}. ${depth}
You play the patient (answer history questions in quotes, in the patient's own plain words) and the bedside nurse.
Open with: setting; the patient's first name, age, sex and chief complaint in one line; then vitals on one line (HR, BP, RR, Temp in °C, SpO2). Then stop and wait.
After that, answer ONLY what the user asks. Give exam findings only for the specific exam they perform and results only for tests they order, with realistic values and units. Never name or strongly hint at the diagnosis. Keep replies brief.
If the user orders something inappropriate or dangerous, let the nurse react realistically.
When the user writes "DIAGNOSIS:" followed by their answer, step out of role as the attending and give Markdown feedback: the actual diagnosis and whether they got it; the key findings that pointed to it; what they missed or over-ordered; a ranked differential of 3-4; next steps in management; and a 1-10 score with one sentence of advice.`;
}

export function quizPrompt(p: Profile, opts: { subject?: string; exam?: string; avoid: string[] }): string {
  const subject = opts.subject && opts.subject !== "Any" ? opts.subject : p.role === "student" ? "any area of medicine" : (p.specialty ?? "general medicine");
  const style =
    opts.exam && opts.exam.trim()
      ? `${opts.exam}-style`
      : p.role === "student"
        ? "medical licensing exam-style"
        : p.role === "resident"
          ? `${p.specialty ?? ""} board-exam-style`
          : "CME self-assessment-style";
  const avoid = opts.avoid.length ? `Do not repeat these recent topics: ${opts.avoid.join("; ")}.` : "";
  return `Write one original ${style} single-best-answer question on ${subject} for ${audience(p)}.
${avoid}
The stem is a clinical vignette: age, sex, presentation, relevant history, vitals and labs with units. Then a one-sentence lead-in question. Exactly five answer choices with plausible distractors and exactly one clearly best answer. Ensure medical accuracy.
"answer" is the 0-based index of the correct choice. "whyNot" has one sentence per choice in the same order; for the correct choice, restate why it is right. "pearl" is one high-yield sentence.`;
}

export function flashcardPrompt(p: Profile, topic: string): string {
  return `Make 8 flashcards for ${audience(p)} on: ${topic}.
Fronts are short questions or cues. Backs are concise, accurate answers of at most 35 words. Favor high-yield mechanisms, classic presentations, key numbers and commonly tested distinctions${p.role === "practitioner" ? ", and practical management points" : ""}.`;
}
