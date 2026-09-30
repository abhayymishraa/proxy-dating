import { ApifyClient } from "apify-client";

// Actors: official Apify Instagram scraper + HarvestAPI LinkedIn scraper (public data, no cookies/login).
const IG_ACTOR = process.env.APIFY_IG_ACTOR ?? "apify/instagram-profile-scraper";
const LI_ACTOR = process.env.APIFY_LI_ACTOR ?? "harvestapi/linkedin-profile-scraper";

const apify = () => new ApifyClient({ token: process.env.APIFY_TOKEN });

export const LI_RE = /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/([^/?#]+)\/?/i;
export const IG_RE = /^https?:\/\/(www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(\?.*)?$/i;

export function normalize(li: string, ig: string) {
  const l = li.trim().match(LI_RE);
  const i = ig.trim().match(IG_RE);
  if (!l) throw new Error("LinkedIn link must look like https://www.linkedin.com/in/<handle>");
  if (!i || ["p", "reel", "explore", "stories"].includes(i[2].toLowerCase()))
    throw new Error("Instagram link must look like https://www.instagram.com/<username>");
  return {
    linkedin: `https://www.linkedin.com/in/${decodeURIComponent(l[2]).toLowerCase()}`,
    instagram: `https://www.instagram.com/${i[2].toLowerCase()}`,
    igUser: i[2].toLowerCase(),
  };
}

async function runActor(actor: string, input: Record<string, unknown>) {
  const run = await apify().actor(actor).call(input, { waitSecs: 300 });
  const { items } = await apify().dataset(run.defaultDatasetId).listItems();
  return items as Record<string, unknown>[];
}

export async function scrapeLinkedin(url: string) {
  const [item] = await runActor(LI_ACTOR, { urls: [url], profileScraperMode: "Profile details no email ($4 per 1k)" });
  if (!item || (!item.headline && !item.firstName)) throw new Error("LinkedIn profile not found or not public");
  return item;
}

export type Instagram = {
  username: string; fullName?: string; biography?: string; private?: boolean;
  profilePicUrl?: string; profilePicUrlHD?: string; externalUrl?: string; businessCategoryName?: string;
  followersCount?: number; followsCount?: number; postsCount?: number;
  latestPosts?: { caption?: string; hashtags?: string[]; mentions?: string[]; displayUrl?: string;
    type?: string; timestamp?: string; locationName?: string; likesCount?: number }[];
};

export async function scrapeInstagram(username: string) {
  const [item] = (await runActor(IG_ACTOR, { usernames: [username] })) as Instagram[];
  if (!item || !item.username) throw new Error("Instagram profile not found");
  if (item.private) throw new Error("Instagram profile is private — only public profiles are supported");
  return item;
}

// IG CDN urls expire, so images are fetched once and kept as base64.
export async function fetchImage(url: string | undefined) {
  if (!url) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const type = r.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(type)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 4_500_000) return null;
    return { type: type as "image/jpeg", data: buf.toString("base64") };
  } catch {
    return null;
  }
}
