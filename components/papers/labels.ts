// Words printed on a paper, in English or Chinese (the pack's language decides).
import type { SkillLevel, SkillSubject } from "@/lib/types";

export const isChinese = (language: string) => language.startsWith("zh");

const LEVEL: Record<SkillLevel, { en: string; zh: string }> = {
  P3: { en: "Primary 3", zh: "小三" },
  P6: { en: "Primary 6", zh: "小六" },
  "Sec 2": { en: "Secondary 2", zh: "中二" },
};

const SUBJECT: Record<SkillSubject, { en: string; zh: string }> = {
  science: { en: "Science", zh: "科学" },
  maths: { en: "Mathematics", zh: "数学" },
  english: { en: "English", zh: "英文" },
  chinese: { en: "Chinese", zh: "华文" },
};

export const levelName = (level: SkillLevel) => LEVEL[level].en;
export const levelNameZh = (level: SkillLevel) => LEVEL[level].zh;
export const subjectName = (subject: SkillSubject) => SUBJECT[subject].en;
export const subjectNameZh = (subject: SkillSubject) => SUBJECT[subject].zh;

/** Short subject label for lists: "Maths" rather than "Mathematics". */
export const subjectShort = (subject: SkillSubject) => (subject === "maths" ? "Maths" : SUBJECT[subject].en);

export function minutesLabel(minutes: number, zh = false): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (zh) return `${h ? `${h}小时` : ""}${m ? `${m}分钟` : ""}` || "—";
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ") || "—";
}

const ZH_NUMBERS = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

/** "Section A" / "第一部分". */
export function sectionLabel(index: number, zh: boolean): string {
  return zh ? `第${ZH_NUMBERS[index] ?? index + 1}部分` : `Section ${String.fromCharCode(65 + index)}`;
}

export const marksLabel = (marks: number) => `${marks} mark${marks === 1 ? "" : "s"}`;

/** "28 Oct 2026" in Singapore time. */
export function dateLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Singapore" }).format(date);
}

/** Today, for "made on" lines. Request time only. */
export const todayLabel = () => dateLabel(new Date());
