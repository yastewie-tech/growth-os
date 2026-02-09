import { RU } from "./ru";

export function t(key: string): string {
  return RU[key] || key;
}
