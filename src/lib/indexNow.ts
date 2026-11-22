import { SITE_URL } from "./agentCopy";

export const INDEXNOW_KEY = "e9f8a3c271b0458fa6c391d8e4f720ab";
export const INDEXNOW_HOST = "www.sonifysphere.earth";

export const INDEXNOW_URLS: readonly string[] = [
  `${SITE_URL}/`,
  `${SITE_URL}/about`,
  `${SITE_URL}/listen`,
  `${SITE_URL}/challenge`,
  `${SITE_URL}/challenge/guess`,
  `${SITE_URL}/challenge/match`,
  `${SITE_URL}/challenge/ribbons`,
  `${SITE_URL}/contact`,
  `${SITE_URL}/privacy`,
  `${SITE_URL}/story`,
  `${SITE_URL}/llms.txt`,
];

export interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

export function buildIndexNowPayload(urls: readonly string[] = INDEXNOW_URLS): IndexNowPayload {
  return {
    host: INDEXNOW_HOST,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: [...urls],
  };
}

export async function submitToIndexNow(
  urls: readonly string[] = INDEXNOW_URLS,
  fetchImpl: typeof fetch = fetch
): Promise<{ ok: boolean; status: number; text: string }> {
  const payload = buildIndexNowPayload(urls);

  const response = await fetchImpl("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  return {
    ok: response.ok || response.status === 200 || response.status === 202,
    status: response.status,
    text,
  };
}
