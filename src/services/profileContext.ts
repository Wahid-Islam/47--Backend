/** Shared profile features used by the recommendation model. */
export interface ProfileContext {
  age: number;
  gender: string;
  activityLevel: string;
  dietHabit: string;
  smoking: boolean;
  bmi: number;
  alcohol: string;
  sleepHours: number;
  highBloodPressure: boolean;
  healthAge?: number;
  topRisks?: string[];
}
