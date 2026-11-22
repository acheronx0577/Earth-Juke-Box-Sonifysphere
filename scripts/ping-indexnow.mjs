#!/usr/bin/env node

const INDEXNOW_KEY = "e9f8a3c271b0458fa6c391d8e4f720ab";
const HOST = "www.sonifysphere.earth";
const SITE_URL = "https://www.sonifysphere.earth";

const URLS = [
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

async function ping() {
  console.log(`Submitting ${URLS.length} URLs to IndexNow (Bing / Yandex / Naver)...`);
  const payload = {
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: URLS,
  };

  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });

    const body = await res.text();
    if (res.ok || res.status === 200 || res.status === 202) {
      console.log(`IndexNow submission successful! Status: ${res.status}`);
      console.log(body || "(empty response, submission acknowledged)");
    } else {
      console.warn(`IndexNow returned status ${res.status}: ${body}`);
    }
  } catch (err) {
    console.error("IndexNow ping failed:", err.message);
  }
}

ping();
