// Writes contributions.json (daily counts per year) using the GitHub GraphQL API.
// Needs a token with the read:user scope in GH_TOKEN so private contributions are included.
import { writeFileSync } from "node:fs";

const LOGIN = "rex-bit";
const token = process.env.GH_TOKEN;
if (!token) { console.error("GH_TOKEN is missing"); process.exit(1); }

const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

async function gql(query, variables) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", "User-Agent": "contrib-grid" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) { console.error(JSON.stringify(json.errors || json)); process.exit(1); }
  return json.data;
}

const created = (await gql("query($l:String!){user(login:$l){createdAt}}", { l: LOGIN })).user.createdAt;
const cur = new Date().getUTCFullYear();
const start = Math.max(new Date(created).getUTCFullYear(), cur - 3);

const Q = `query($l:String!,$from:DateTime!,$to:DateTime!){user(login:$l){contributionsCollection(from:$from,to:$to){
  contributionCalendar{weeks{contributionDays{date contributionCount contributionLevel}}}}}}`;

const years = {};
for (let y = start; y <= cur; y++) {
  const d = await gql(Q, { l: LOGIN, from: `${y}-01-01T00:00:00Z`, to: `${y}-12-31T23:59:59Z` });
  const days = [];
  for (const w of d.user.contributionsCollection.contributionCalendar.weeks)
    for (const x of w.contributionDays)
      if (x.date.startsWith(String(y)))
        days.push({ date: x.date, count: x.contributionCount, level: LEVELS[x.contributionLevel] ?? 0 });
  years[y] = days;
}
writeFileSync("contributions.json", JSON.stringify({ updated: new Date().toISOString(), years }));
console.log("years:", Object.keys(years).join(", "));
