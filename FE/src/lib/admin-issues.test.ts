import { describe, expect, it } from "vitest";
import { activityHref, activityText, ATTENTION_META, isTrainingIssue, relativeTime, TRAINING_ISSUES } from "./admin-issues";

describe("admin-issues", () => {
  it("filter ?issue= dikenali, nilai asing ditolak", () => {
    expect(TRAINING_ISSUES).toEqual(["no-cover", "cover-no-alt", "stale-draft", "no-summary"]);
    expect(isTrainingIssue("stale-draft")).toBe(true);
    expect(isTrainingIssue("lain")).toBe(false);
    expect(isTrainingIssue(null)).toBe(false);
  });

  it("tautan perlu dibereskan: item ke halaman edit, lihat semua ke daftar terfilter", () => {
    expect(ATTENTION_META.trainingNoCover.item("t1")).toBe("/admin/trainings/t1");
    expect(ATTENTION_META.trainingNoCover.all).toBe("/admin/trainings?issue=no-cover");
    expect(ATTENTION_META.pastOpenSchedule.all).toBe("/admin/schedules?period=past&status=OPEN");
    expect(ATTENTION_META.serviceNoImage.all).toBe("/admin/services?issue=no-image");
  });

  it("aktivitas: halaman edit kalau ada, daftar modul untuk entitas dialog, null untuk lainnya", () => {
    expect(activityHref("Training", "t1")).toBe("/admin/trainings/t1");
    expect(activityHref("HomeSection", "h1")).toBe("/admin/home/h1");
    expect(activityHref("Client", "c1")).toBe("/admin/clients");
    expect(activityHref("ContentSync", "x")).toBeNull();
    expect(activityText("UPDATE", "Training")).toBe("mengubah pelatihan");
    expect(activityText("REORDER", "Nav")).toBe("mengurutkan menu");
  });

  it("waktu relatif dalam Bahasa Indonesia", () => {
    const now = Date.parse("2026-10-13T08:00:00Z");
    expect(relativeTime("2026-10-13T07:55:00Z", now)).toBe("5 menit yang lalu");
    expect(relativeTime("2026-10-12T08:00:00Z", now)).toBe("kemarin");
  });
});
