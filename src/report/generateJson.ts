import { ScanReport } from "./types";

export function generateJson(report: ScanReport): string {
  return JSON.stringify(report, null, 2);
}
