import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return `£${amount.toFixed(2)}`;
}

export function isHappyHour(): boolean {
  const now = new Date();
  const hours = now.getHours();
  return hours >= 16 && hours < 19; // 4pm - 7pm
}

export function isBreakfastTime(): boolean {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  const breakfastStart = 7 * 60; // 7:00am
  const breakfastEnd = 11 * 60 + 30; // 11:30am

  // Mon-Fri (1-5)
  return day >= 1 && day <= 5 && timeInMinutes >= breakfastStart && timeInMinutes < breakfastEnd;
}

export function getTimeElapsed(dateStr: string): string {
  const now = new Date();
  const created = new Date(dateStr);
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${hours}h ${mins}m ago`;
}
