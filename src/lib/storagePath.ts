export const DEMO_BUCKETS = ["project_img", "study-images", "card_news"] as const;
export function assertDemoStoragePath(bucket: string, filename: string) {
  if (!(DEMO_BUCKETS as readonly string[]).includes(bucket) || !filename || filename.startsWith("/") || filename.includes("\\") || /[%?#\x00-\x1f\x7f]/.test(filename) || filename.split("/").some(part => !part || part === "." || part === "..")) {
    throw new Error("허용되지 않은 데모 이미지 경로입니다.");
  }
}
