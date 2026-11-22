import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/agentCopy";

const PATH_ENTRIES: Array<{ path: string; priority: number; changeFrequency: "weekly" | "monthly" }> = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/listen", priority: 0.9, changeFrequency: "weekly" },
  { path: "/challenge", priority: 0.9, changeFrequency: "weekly" },
  { path: "/challenge/guess", priority: 0.8, changeFrequency: "weekly" },
  { path: "/challenge/match", priority: 0.8, changeFrequency: "weekly" },
  { path: "/challenge/ribbons", priority: 0.8, changeFrequency: "weekly" },
  { path: "/about", priority: 0.8, changeFrequency: "weekly" },
  { path: "/story", priority: 0.8, changeFrequency: "weekly" },
  { path: "/contact", priority: 0.7, changeFrequency: "weekly" },
  { path: "/privacy", priority: 0.6, changeFrequency: "monthly" },
  { path: "/llms.txt", priority: 0.5, changeFrequency: "weekly" },
  { path: "/llms-full.txt", priority: 0.5, changeFrequency: "weekly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PATH_ENTRIES.map((entry) => ({
    url: new URL(entry.path, SITE_URL).href,
    lastModified,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));
}
