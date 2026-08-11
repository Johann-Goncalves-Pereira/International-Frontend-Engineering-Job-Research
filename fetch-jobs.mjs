import fs from 'fs/promises';

// Front-end & International Remote Filters
const TARGET_KEYWORDS = ['frontend', 'front-end', 'react', 'vue', 'qwik', 'elm', 'typescript', 'javascript', 'ui', 'ux'];
const EXCLUDE_KEYWORDS = ['senior manager', 'director', 'lead engineer'];

async function fetchHimalayas() {
  try {
    const res = await fetch('https://himalayas.app/jobs/api?limit=50');
    if (!res.ok) return [];
    const data = await res.json();
    return (data.jobs || []).map(j => ({
      title: j.title,
      company: j.companyName,
      url: j.applicationUrl || j.url,
      source: 'Himalayas',
      pubDate: new Date(j.pubDate || Date.now()),
      location: j.location || 'Worldwide'
    }));
  } catch {
    return [];
  }
}

async function fetchJobicy() {
  try {
    const res = await fetch('https://jobicy.com/api/v2/remote-jobs?count=50&industry=engineering');
    if (!res.ok) return [];
    const data = await res.json();
    return (data.jobs || []).map(j => ({
      title: j.jobTitle,
      company: j.companyName,
      url: j.url,
      source: 'Jobicy',
      pubDate: new Date(j.pubDate || Date.now()),
      location: j.jobGeo || 'Remote'
    }));
  } catch {
    return [];
  }
}

async function fetchRemoteOK() {
  try {
    const res = await fetch('https://remoteok.com/api', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.slice(1).map(j => ({
      title: j.position,
      company: j.company,
      url: j.url,
      source: 'RemoteOK',
      pubDate: new Date(j.date || Date.now()),
      location: j.location || 'Worldwide'
    }));
  } catch {
    return [];
  }
}

async function fetchArbeitnow() {
  try {
    const res = await fetch('https://www.arbeitnow.com/api/job-board-api');
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map(j => ({
      title: j.title,
      company: j.company_name,
      url: j.url,
      source: 'Arbeitnow',
      pubDate: new Date(j.created_at * 1000 || Date.now()),
      location: j.location || 'Remote'
    }));
  } catch {
    return [];
  }
}

function matchesTarget(job) {
  const fullText = `${job.title} ${job.location}`.toLowerCase();
  const hasTarget = TARGET_KEYWORDS.some(kw => fullText.includes(kw));
  const hasExcluded = EXCLUDE_KEYWORDS.some(kw => fullText.includes(kw));
  return hasTarget && !hasExcluded;
}

async function main() {
  console.log('⚡ Starting parallel job aggregation...');
  const results = await Promise.all([
    fetchHimalayas(),
    fetchJobicy(),
    fetchRemoteOK(),
    fetchArbeitnow()
  ]);

  const allJobs = results.flat();
  const filtered = allJobs.filter(matchesTarget);

  // Deduplicate by URL
  const uniqueJobs = Array.from(
    new Map(filtered.map(j => [j.url, j])).values()
  );

  // Sort by newest
  uniqueJobs.sort((a, b) => b.pubDate - a.pubDate);

  const today = new Date().toISOString().split('T')[0];
  let markdown = `# Daily Remote Front-End Jobs Digest (${today})\n\n`;
  markdown += `*Total Matching Roles Found: ${uniqueJobs.length}*\n\n---\n\n`;

  uniqueJobs.forEach(job => {
    markdown += `### [${job.title}](${job.url})\n`;
    markdown += `**Company:** ${job.company} | **Source:** ${job.source} | **Location:** ${job.location}\n\n`;
  });

  await fs.writeFile('JOBS_DIGEST.md', markdown);
  console.log(`✅ Success! Generated JOBS_DIGEST.md with ${uniqueJobs.length} roles.`);

  // Optional: Post to Webhook (Discord / Slack) if secret exists
  if (process.env.DISCORD_WEBHOOK_URL) {
    const topJobs = uniqueJobs.slice(0, 10);
    const discordMessage = {
      content: `🚀 **Daily Front-End Jobs Digest (${today})** - Found ${uniqueJobs.length} positions.\n\n` +
        topJobs.map(j => `• **[${j.title}](${j.url})** at ${j.company} (${j.location})`).join('\n')
    };
    await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordMessage)
    });
  }
}

main().catch(console.error);