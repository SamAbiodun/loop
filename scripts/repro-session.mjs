import { chromium } from "playwright";

const URL = "http://localhost:3000/";
const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
  ],
});
const context = await browser.newContext({ permissions: ["microphone"] });
const page = await context.newPage();

const counts = {};
page.on("console", (msg) => {
  const t = msg.text();
  const m = t.match(/event (\S+)/);
  if (m) counts[m[1]] = (counts[m[1]] || 0) + 1;
  if (/response\.created|speech_started|speech_stopped|response\.done|conversation\.item\.created|error/.test(t)) {
    console.log(t.slice(0, 120));
  }
});
page.on("pageerror", (e) => console.log("[pageerror]", e.message));

await page.goto(URL, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Start interview" }).click();
await page.waitForTimeout(1000);
await page.getByRole("button", { name: "Start session" }).click();
await page.waitForTimeout(9000);

console.log("\n== event counts ==");
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${v}× ${k}`);
}
await browser.close();
