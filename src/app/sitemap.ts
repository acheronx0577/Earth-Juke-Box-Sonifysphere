import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/agentCopy";

const PATHS = [
  "/",
  "/listen",
  "/about",
  "/challenge",
  "/challenge/guess",
  "/challenge/match",
  "/challenge/ribbons",
  "/contact",
  "/privacy",
  "/story",
  "/llms.txt",
  "/llms-full.txt",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((path) => ({
    url: new URL(path, SITE_URL).href,
    changeFrequency: "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
