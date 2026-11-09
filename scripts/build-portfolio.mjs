import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { articles } from "../content/articles.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const profile = JSON.parse(
  await readFile(path.join(root, "content/profile.json"), "utf8"),
);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
for (const key of [
  "portrait",
  "introductionVideo",
  "introductionPoster",
  "introductionCaptions",
]) {
  if (profile[key]) {
    if (!profile[key].startsWith("/assets/") || profile[key].includes(".."))
      throw new Error(`${key} must be a local /assets/ path`);
    await access(path.join(publicDir, profile[key]));
  }
}
const arrow = '<span aria-hidden="true">↗</span>';
const emailLink = `mailto:${profile.email}`;
const navItems = [
  ["Home", "/"],
  ["About", "/about"],
  ["Work", "/work"],
  ["Writing", "/journal"],
  ["Résumé", "/resume"],
  ["Contact", "/contact"],
];
const external = (href, label, cls = "") =>
  `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${label} ${arrow}<span class="sr-only"> (opens in a new tab)</span></a>`;
const link = (href, label, cls = "text-link") =>
  `<a class="${cls}" href="${href}">${label} ${arrow}</a>`;
const eyebrow = (text) => `<p class="eyebrow">${text}</p>`;
const intro = (label, title, description) =>
  `<header class="page-intro">${eyebrow(label)}<h1>${title}</h1><p class="intro-deck">${description}</p></header>`;
const wordCount = (a) =>
  a.sections
    .flatMap((s) => s.slice(1))
    .join(" ")
    .split(/\s+/).length;
const readTime = (a) => Math.ceil(wordCount(a) / 220);
const journalList = () =>
  `<div class="essay-list">${articles.map((a) => `<a class="essay-row" href="/journal/${a.slug}"><span class="essay-number">${a.number}</span><div>${eyebrow(a.category)}<h3>${a.title}</h3><p>${a.deck}</p></div><span class="essay-time">${readTime(a)} min read ${arrow}</span></a>`).join("")}</div>`;
const footer = `<footer class="footer"><div class="footer-top">${eyebrow("A good conversation is a good place to start.")}<a class="footer-invite" href="${emailLink}">Let’s make<br>something <em>matter.</em> ${arrow}</a><div class="footer-links">${external(profile.linkedin, "LinkedIn")}${link("/contact", "Get in touch")}${link("/assets/carlo-doroff-resume.pdf", "Résumé PDF")}</div></div><div class="footer-bottom"><a href="/" class="wordmark">CD<span class="red">.</span></a><span>© 2026 Carlo Doroff</span><span>Curiosity. Conviction. Follow-through.</span><a href="#top">Back to top ↑</a></div></footer>`;
function page(title, description, body, active, className = "") {
  return `<!doctype html>
<html lang="en" class="no-js"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)} | Carlo Doroff</title><meta name="description" content="${esc(description)}"><meta property="og:title" content="${esc(title)} | Carlo Doroff"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="${active === "Writing" && className === "article-page" ? "article" : "website"}"><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="preload" href="/assets/barlow-condensed-800.ttf" as="font" type="font/ttf" crossorigin><link rel="preload" href="/assets/dm-sans-400.ttf" as="font" type="font/ttf" crossorigin><link rel="stylesheet" href="/site.css"><script src="/site.js" defer></script></head>
<body id="top" class="${className}"><a class="skip-link" href="#main">Skip to content</a><header class="site-header"><a href="/" class="wordmark" aria-label="Carlo Doroff home">CD<span class="red">.</span></a><span class="header-note">A builder’s point of view.</span><button class="menu-toggle" data-menu-toggle aria-expanded="false" aria-controls="main-nav">Menu +</button><nav id="main-nav" aria-label="Main navigation">${navItems.map(([name, href]) => `<a href="${href}" ${name === active ? 'aria-current="page"' : ""}>${name}${name === "Contact" ? " " + arrow : ""}</a>`).join("")}</nav></header><main id="main">${body}</main>${footer}</body></html>`;
}
const poster = `<figure class="manifesto-poster"><div class="poster-top"><span>THE WORKING PHILOSOPHY</span><span>№ 001</span></div><div class="poster-orbit" aria-hidden="true"><i></i><i></i><i></i><span>↗</span></div><p>MAKE<br>IT REAL</p><figcaption>Ideas become interesting<br>when you do something with them.</figcaption><span class="poster-corner" aria-hidden="true">CD.</span></figure>`;
const portrait = profile.portrait
  ? `<figure class="portrait"><img src="${esc(profile.portrait)}" alt="${esc(profile.portraitAlt)}" width="900" height="1100"><figcaption>Carlo Doroff · founder, builder, student.</figcaption></figure>`
  : poster;
const projects = [
  {
    id: "morsa",
    n: "01",
    name: "Morsa",
    category: "Go-to-market / AI operations",
    tag: "2026 — PRESENT",
    summary: "Bringing AI into the work that makes things.",
    class: "morsa",
    graphic: "MORSA",
    description:
      "Building the North American go-to-market function for an AI operations platform serving manufacturers.",
    href: "/work#morsa",
  },
  {
    id: "craze",
    n: "02",
    name: "Craze",
    category: "Founder / Product / Consumer insight",
    tag: "2025 — 2026 · ACQUI-HIRED",
    summary: "From a question to a company.",
    class: "craze",
    graphic: "craze",
    description:
      "An AI interview platform connecting brands with Gen Z. Built end to end, from product to paying pilots.",
    href: "/work#craze",
  },
  {
    id: "ecoshield",
    n: "03",
    name: "The $107K summer",
    category: "Sales / Communication / Leadership",
    tag: "SUMMER 2025",
    summary: "Real conversations. Real conviction.",
    class: "sales",
    graphic: "$107K+",
    description:
      "A summer of door-to-door sales, full-cycle ownership, and learning how to earn someone’s attention.",
    href: "/work#ecoshield",
  },
];
function projectArt(p) {
  const inside =
    p.id === "morsa"
      ? `<div class="morsa-symbol" aria-hidden="true"><i></i><i></i><i></i><i></i></div><strong>${p.graphic}</strong><div class="art-bottom"><span>HUMAN AMBITION.<br>INDUSTRIAL INTELLIGENCE.</span><span>↗</span></div>`
      : p.id === "craze"
        ? `<div class="craze-star" aria-hidden="true">✳</div><strong>${p.graphic}</strong><div class="art-bottom"><span>ASK BETTER QUESTIONS.</span><span>10,000+ VOICES</span></div>`
        : `<span class="sales-top">A SUMMER IN THE FIELD</span><strong>${p.graphic}</strong><div class="sales-lines" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="art-bottom"><span>CONTRACT VALUE</span><span>2025 ↗</span></div>`;
  return `<div class="project-art art-${p.class}" role="img" aria-label="${esc(p.name)} — ${esc(p.summary)}. Editorial project illustration.">${inside}</div>`;
}
const projectCards = projects
  .map(
    (p) =>
      `<a class="project-card" href="${p.href}">${projectArt(p)}<div class="project-card-meta">${eyebrow(p.category)}${arrow}</div><h3>${p.name}</h3><p>${p.description}</p></a>`,
  )
  .join("");
const home = `<section class="home-hero"><div class="hero-kicker">${eyebrow("Founder. Builder. GTM.")}<span class="status"><i></i> Currently at Morsa</span><span class="hero-edition">SELECTED WORK / 2025—26</span></div><h1 class="hero-name">CARLO DOROFF<span>.</span></h1><div class="hero-main"><div class="hero-copy"><h2>Curiosity gets me started.<br><em>Conviction</em> gets it built.</h2><p>I turn customer conversations into products, and products into businesses. Former founder of Craze. Now building go-to-market at Morsa. Always a student.</p><div class="button-row">${link("/work", "Explore my work", "button button-dark")}${link("/about", "The person behind it", "text-link")}</div></div>${portrait}</div><div class="hero-foot"><span>BUSINESS INSTINCT. BUILDER’S HANDS.</span><span>SCROLL TO GET THE FULL PICTURE ↓</span></div></section>
<section class="section work-preview"><div class="section-heading"><div>${eyebrow("01 / Selected work")}<h2>A few things<br>I’ve <em>put into motion.</em></h2></div>${link("/work", "The work, in detail")}</div><div class="project-grid">${projectCards}</div></section>
<section class="proof-strip" aria-label="Selected achievements"><div><strong>$80K</strong><span>Raised at Craze</span></div><div><strong>10,000+</strong><span>Students in the Craze panel</span></div><div><strong>198</strong><span>Campuses represented</span></div><div><strong>$107K+</strong><span>Summer sales contract value</span></div></section>
<section class="section personal-preview"><div>${eyebrow("02 / A little context")}<h2>More than<br>a <em>job title.</em></h2>${link("/about", "Get to know me")}</div><div><p class="large-copy">I’m drawn to the space where human behavior meets technology. What makes someone care? What gets in their way? What could we build to help?</p><p>That curiosity has taken me from doorsteps in Massachusetts to building a consumer insights company, investment banking, and AI for manufacturers. Along the way, I’m studying entrepreneurship at the University of Miami.</p><div class="interest-tags"><span>Entrepreneurship</span><span>Psychology</span><span>Bodybuilding</span><span>Languages</span></div></div></section>
<section class="section writing-preview"><div class="section-heading"><div>${eyebrow("03 / Field notes")}<h2>Thinking <em>out loud.</em></h2></div>${link("/journal", "All writing")}</div>${journalList()}</section>`;
const about = `${intro("01 / About me", "A curious mind.<br>A bias toward <em>doing.</em>", "I’m Carlo: a founder, builder, and entrepreneurship student interested in how people think—and what we can make useful for them.")}${profile.introductionVideo ? `<div class="introduction-jump">${link("#introduction", "Watch my introduction", "text-link")}</div>` : ""}<section class="about-grid">${portrait}<div class="prose"><h2>The thread through it all.</h2><p>My experience crosses sales, finance, product development, and go-to-market. The thread connecting those worlds is a desire to understand a problem well enough to do something about it.</p><p>I founded Craze, an AI interview platform for Gen Z consumer insights, and built its full-stack product myself. We raised $80,000, grew a team of four, and reached more than 10,000 verified students across 198 campuses. Craze was acqui-hired in 2026.</p><p>Today, I’m the founding GTM lead at Morsa, building its North American commercial function for an AI operations platform serving manufacturers. My work moves between prospect research, customer conversations, outbound systems, and product feedback.</p><p>I’m also pursuing a BBA in Entrepreneurship at the University of Miami, with graduation expected in May 2028. Building while studying gives me two places to test my thinking: the classroom and the real world.</p>${link("/resume", "See the full résumé")}</div></section>
<section class="section"><div class="section-heading"><div>${eyebrow("How I work")}<h2>Three words.<br><em>A working standard.</em></h2></div></div><div class="values-grid"><article><span class="value-number">01</span><h3>Curious.</h3><p>Start with a question worth asking. Customer discovery, psychology, and learning languages all ask me to look beyond my first interpretation.</p></article><article><span class="value-number">02</span><h3>Resourceful.</h3><p>Move between the commercial and technical sides of a problem. I can have the customer conversation, build the first version, and connect the systems behind it.</p></article><article><span class="value-number">03</span><h3>Accountable.</h3><p>Stay close to the outcome. Building a product, carrying a sales target, and training new representatives all make the follow-through personal.</p></article></div></section>
<section class="section personal-preview"><div>${eyebrow("Away from the desk")}<h2>Still <em>curious.</em></h2></div><div><p class="large-copy">Bodybuilding. Difficult fitness challenges. A book that makes me reconsider something.</p><p>My interests include existentialism, psychology, reading, and venture capital. I speak Portuguese natively, French at an advanced level, and Mandarin at an intermediate level. I’m interested in the different ways people communicate, make choices, and find meaning in their work.</p><p>Looking ahead, I want to keep building at the intersection of customer understanding, useful technology, and commercial execution. I’m especially interested in small teams where taking ownership means crossing more than one job description.</p></div></section>
${profile.introductionVideo ? `<section class="section introduction" id="introduction" aria-labelledby="introduction-title"><div class="introduction-copy">${eyebrow("In my own words / 01:02")}<h2 id="introduction-title">A quick <em>hello.</em></h2><p class="introduction-deck">The person behind the work, in my own words. A little about where I’m from, what I’ve built, and what’s next.</p>${profile.introductionTranscript ? `<details><summary>Read the video transcript</summary><p>${esc(profile.introductionTranscript)}</p></details>` : ""}</div><video controls playsinline preload="metadata" width="720" height="1280" aria-label="Carlo Doroff’s personal introduction" ${profile.introductionPoster ? `poster="${esc(profile.introductionPoster)}"` : ""}><source src="${esc(profile.introductionVideo)}" type="video/mp4">${profile.introductionCaptions ? `<track kind="captions" src="${esc(profile.introductionCaptions)}" srclang="en" label="English" default>` : ""}Your browser does not support embedded video. <a href="${esc(profile.introductionVideo)}">Download the introduction</a>.</video></section>` : ""}`;

const work = `${intro("02 / Selected work", "From first question<br>to <em>follow-through.</em>", "A portfolio of building, selling, and making the pieces work together. Here’s the context, my contribution, and the evidence.")}<nav class="project-index" aria-label="Jump to project">${projects.map((p) => `<a href="#${p.id}"><span>${p.n}</span> ${p.name} ↓</a>`).join("")}<a href="#lab"><span>04</span> The creative lab ↓</a></nav>
<section class="case-study" id="morsa"><div class="case-heading">${eyebrow("01 / Morsa · August 2026—present")}<h2>Helping AI find<br>its place in <em>real operations.</em></h2></div>${projectArt(projects[0])}<div class="case-body"><aside><dl><dt>Role</dt><dd>Founding GTM Lead</dd><dt>Focus</dt><dd>North American go-to-market</dd><dt>Audience</dt><dd>Manufacturing executives &amp; plant leaders</dd></dl></aside><div class="prose"><h3>The context</h3><p>Morsa is an AI operations platform serving manufacturers. Bringing that product to market means understanding the workflows and operational pain points of the people who run those businesses.</p><h3>My contribution</h3><p>I’m building the North American go-to-market function from the ground up. I designed outbound infrastructure across Attio, Lemlist, Clay, email, and LinkedIn, covering account sourcing, enrichment, deduplication, sequencing, and pipeline management.</p><p>I own ideal customer profile development, messaging, prospect research, discovery, and early-stage pipeline generation. I also turn customer conversations into structured product feedback for the founding team.</p><h3>The work in progress</h3><p>The focus is a repeatable commercial process: relevant accounts, informed conversations, clear next steps, and useful feedback to the product team. This is an ongoing role; the work is still being built.</p>${link("/journal/automate-the-friction", "Read my approach to automation")}</div></div></section>
<section class="case-study" id="craze"><div class="case-heading">${eyebrow("02 / Craze · August 2025—August 2026 · Acqui-hired")}<h2>Better questions.<br><em>Closer to the customer.</em></h2></div>${projectArt(projects[1])}<div class="case-body"><aside><dl><dt>Role</dt><dd>Founder &amp; CEO</dd><dt>Built</dt><dd>Full-stack AI interview platform</dd><dt>Team</dt><dd>Grew from 1 to 4 FTE</dd></dl>${external("https://joincraze.com", "Visit Craze", "text-link")}</aside><div class="prose"><h3>The context</h3><p>Brands need to understand the people they want to reach. Craze brought AI interviews and a verified student panel together to deliver Gen Z consumer insights in hours.</p><h3>My contribution</h3><p>I engineered the full-stack platform solo, end to end, while leading the company’s fundraising, team growth, and founder-led sales. Multi-channel outbound generated one to three customer meetings daily.</p><h3>The evidence</h3><ul><li>$80,000 raised from Atheneum Ventures and Jackson Square Ventures.</li><li>Four paying brand pilots in the first two months, including a national-scale engagement with Celsius.</li><li>10,000+ verified college students across 198 campuses.</li><li>Top award at University of Miami Startup Lab Demo Day.</li></ul><p>Craze was acqui-hired in 2026. The experience brought product building, customer discovery, fundraising, and distribution into one role.</p>${link("/journal/build-close-to-the-customer", "Read the thinking behind the work")}</div></div></section>
<section class="case-study" id="ecoshield"><div class="case-heading">${eyebrow("03 / EcoShield · May—August 2025")}<h2>A summer of<br><em>earning the conversation.</em></h2></div>${projectArt(projects[2])}<div class="case-body"><aside><dl><dt>Role</dt><dd>Door-to-Door Sales Representative</dd><dt>Location</dt><dd>Winchester, Massachusetts</dd><dt>Focus</dt><dd>Full-cycle sales &amp; team training</dd></dl></aside><div class="prose"><h3>The context</h3><p>Door-to-door sales compresses the work of earning attention, understanding a need, and explaining value into a direct, in-person conversation.</p><h3>My contribution</h3><p>I delivered hundreds of pitches per week and managed the full sales cycle, from prospecting and objection handling to closing. I also trained three new representatives in those same skills.</p><h3>The evidence</h3><p>I generated more than $107,000 in contract value over the summer, including $26,000 in a single week. For a period, I ranked as the number-one rookie nationally for highest initial contract value.</p><p>That experience is part of the commercial foundation I bring to building products: clear communication, direct feedback, and ownership of the result.</p>${link("/journal/the-work-before-the-pitch", "Read about the work before the pitch")}</div></div></section>
<section class="lab-feature" id="lab"><div>${eyebrow("04 / An experiment in interaction")}<h2>There’s a<br><em>playful side, too.</em></h2><p>The original version of this site is an interactive portfolio with a hidden, multi-stage technical challenge. A place to explore motion, sound, code, and a little curiosity.</p>${link("/lab", "Enter the creative lab", "button button-light")}</div><a class="lab-art" href="/gate" aria-label="Enter the Signal Chain technical challenge"><span>TRANSMISSION / 001</span><strong>FOLLOW<br>THE SIGNAL<span>↗</span></strong><span>FIVE LOCKS. ONE WAY THROUGH.</span></a></section>`;
const resume = `${intro("04 / Résumé", "Commercial instinct.<br><em>Technical range.</em>", "Founder, builder, and founding GTM lead. Experience across AI products, consumer research, investment banking, and full-cycle sales.")}<div class="resume-actions">${link("/assets/carlo-doroff-resume.pdf", "Download résumé", "button button-dark")}<button class="text-link" data-print>Print this page <span aria-hidden="true">↗</span></button><span>PDF · 123 KB</span></div>
<div class="resume-grid"><aside class="resume-sidebar"><div class="resume-monogram" role="img" aria-label="Carlo Doroff monogram">CD<span>.</span></div><h2>Carlo Doroff</h2><a href="${emailLink}">${profile.email}</a>${external(profile.linkedin, "LinkedIn")}<h3>Capabilities</h3><p>Full-cycle sales<br>Founder-led sales<br>Customer discovery<br>Pipeline management<br>Multichannel prospecting<br>Rapid product prototyping<br>Workflow automation<br>AI agents &amp; LLM APIs</p><h3>Languages</h3><p>Portuguese · Native<br>French · Advanced<br>Mandarin · Intermediate</p><h3>Interests</h3><p>Fitness challenges, bodybuilding, venture capital, existentialism, psychology, reading.</p></aside><div class="resume-main"><h2>Experience</h2>
<article class="resume-role"><div><h3>Morsa</h3><span>Aug 2026—present</span></div><p class="role-title">Founding GTM Lead · San Francisco, CA</p><ul><li>Building the North American go-to-market function for an AI operations platform serving manufacturers.</li><li>Designed outbound infrastructure across Attio, Lemlist, Clay, email, and LinkedIn.</li><li>Own ICP development, messaging, prospect research, discovery, and early-stage pipeline generation.</li><li>Translate customer conversations into structured product feedback for the founding team.</li></ul></article>
<article class="resume-role"><div><h3>Craze Inc. <span class="small-tag">Acqui-hired</span></h3><span>Aug 2025—Aug 2026</span></div><p class="role-title">Founder &amp; CEO · Miami, FL</p><ul><li>Raised $80K from Atheneum Ventures and Jackson Square Ventures; scaled from one to four full-time employees.</li><li>Secured four paying brand pilots in the first two months, including a national-scale engagement with Celsius.</li><li>Engineered the full-stack AI interview platform solo, end to end.</li><li>Grew a panel of 10,000+ verified students across 198 campuses; booked one to three customer meetings daily.</li><li>Won the top award at UM Startup Lab Demo Day.</li></ul></article>
<article class="resume-role"><div><h3>Curvature Securities</h3><span>Jan—Apr 2026</span></div><p class="role-title">Investment Banking Intern Analyst · Miami, FL</p><ul><li>Supported investor materials and preparation for Inuvo’s $3.3M private placement (NYSE: INUV), with Curvature as sole placement agent.</li><li>Organized deal-team contact infrastructure and conference planning.</li></ul></article>
<article class="resume-role"><div><h3>EcoShield Pest Solutions</h3><span>May—Aug 2025</span></div><p class="role-title">Door-to-Door Sales Representative · Winchester, MA</p><ul><li>Generated $107K+ in contract value, including $26K in a single week; temporarily ranked the number-one rookie nationally for highest initial contract value.</li><li>Delivered hundreds of pitches per week and managed the full sales cycle.</li><li>Trained three new representatives in prospecting, pitching, objection handling, and closing.</li></ul></article>
<h2>Education</h2><article class="resume-role"><div><h3>University of Miami Business School</h3><span>Expected May 2028</span></div><p>BBA in Entrepreneurship · Coral Gables, FL</p></article><article class="resume-role"><div><h3>Y Combinator Startup School</h3><span>Summer 2026</span></div><p>San Francisco, CA</p></article><h2>Technical toolkit</h2><p>LLM APIs, AI agents, MCP, n8n, prompt engineering, workflow automation, rapid product prototyping, agent orchestration, and system architecture.</p></div></div>`;
const journal = `${intro("03 / Field notes", "Work in progress.<br><em>Thoughts included.</em>", "Essays on building useful things, understanding people, and getting from an idea to something that works.")}<div class="journal-cover"><img src="/assets/field-notes.svg" width="1000" height="680" alt="Field notes illustration: concentric targets and an arrow, representing observation, focus, and action"><div>${eyebrow("The connecting thread")}<p>Pay attention.<br>Ask a better question.<br><em>Make the next move.</em></p><span>THREE ESSAYS / SALES, BUILDING &amp; AI</span></div></div>${journalList()}<section class="journal-note"><p>These are the questions I’m working through as I build. Have a different perspective?</p>${link("/contact", "Let’s compare notes")}</section>`;
const contact = `${intro("05 / Start a conversation", "Something on<br><em>your mind?</em>", "A product idea, a thoughtful question, or a problem worth working on. I’d like to hear it.")}<section class="contact-grid"><div class="contact-details">${eyebrow("The direct route")}<a class="contact-email" href="${emailLink}">${profile.email} ${arrow}</a><button class="text-link" data-copy-email>Copy email address <span aria-hidden="true">+</span></button><p class="status-message" data-copy-status role="status"></p><div class="contact-social">${external(profile.linkedin, "Find me on LinkedIn", "text-link")}${link("/assets/carlo-doroff-resume.pdf", "Take my résumé with you")}</div><div class="conversation-card"><span class="conversation-symbol" role="img" aria-label="Two overlapping circles representing a conversation">◎</span><h2>Good reasons to reach out.</h2><p>Building an early-stage product. Understanding your customers. Making a go-to-market process work better. Or sharing an idea that connects business and technology.</p><p>Tell me what you’re working on, what’s difficult, and where you think I could help.</p></div></div><form id="contact-form" action="mailto:carlodoroff@gmail.com" method="post" enctype="text/plain"><h2>A little context goes a long way.</h2><p>This form prepares an email in your own email app. Nothing is sent until you send it there.</p><label for="name">Your name</label><input id="name" name="name" autocomplete="name" required maxlength="100" placeholder="First and last name"><label for="email">Your email</label><input id="email" name="email" type="email" autocomplete="email" required maxlength="254" placeholder="you@example.com"><label for="topic">What brings you here?</label><select id="topic" name="topic"><option>Building something together</option><option>A work opportunity</option><option>A question or an idea</option><option>Just saying hello</option></select><label for="message">What are you thinking?</label><textarea id="message" name="message" rows="5" required maxlength="3000" placeholder="A little about you and what you have in mind…"></textarea><button class="button button-dark" type="submit">Prepare email <span aria-hidden="true">↗</span></button><p class="status-message" data-form-status role="status"></p><a data-email-draft hidden>Open your prepared email ↗</a><noscript><p>Email me directly at <a href="${emailLink}">${profile.email}</a>.</p></noscript></form></section>`;
const pages = [
  [
    "index.html",
    page(
      "Founder, builder & GTM",
      "Carlo Doroff: founding GTM lead at Morsa, former founder of Craze, and University of Miami entrepreneurship student.",
      home,
      "Home",
      "home-page",
    ),
  ],
  [
    "about.html",
    page(
      "About",
      "Meet Carlo Doroff: the story, values, and interests behind the work.",
      about,
      "About",
    ),
  ],
  [
    "work.html",
    page(
      "Selected work",
      "Explore Carlo Doroff’s work at Morsa, Craze, and EcoShield: context, contributions, and results.",
      work,
      "Work",
    ),
  ],
  [
    "resume.html",
    page(
      "Résumé",
      "Carlo Doroff’s experience, education, skills, and downloadable résumé.",
      resume,
      "Résumé",
      "resume-page",
    ),
  ],
  [
    "journal.html",
    page(
      "Field notes",
      "Essays on sales, entrepreneurship, product building, and practical AI systems.",
      journal,
      "Writing",
    ),
  ],
  [
    "contact.html",
    page(
      "Contact",
      "Get in touch with Carlo Doroff about products, go-to-market, work opportunities, and ideas.",
      contact,
      "Contact",
    ),
  ],
];
for (const [index, a] of articles.entries()) {
  if (wordCount(a) < 600) throw new Error(`${a.slug} is below 600 words`);
  const next = articles[(index + 1) % articles.length];
  const body = `<div class="article-top">${link("/journal", "← All field notes")}</div><header class="article-header">${eyebrow(`Field note ${a.number} / ${a.category}`)}<h1>${a.title}</h1><p class="intro-deck">${a.deck}</p><div class="article-byline"><span>Carlo Doroff</span><span>${readTime(a)} min read · ${wordCount(a)} words</span></div></header><figure class="article-figure"><img src="/assets/field-notes.svg" width="1000" height="680" alt="Concentric targets with an arrow: a field notes illustration about focused action"><figcaption>Field notes / ${a.category}</figcaption></figure><div class="article-layout"><aside>${eyebrow("In this essay")}<nav aria-label="Essay contents">${a.sections.map((s, i) => (s[0] ? `<a href="#section-${i}">${s[0]}</a>` : "")).join("")}</nav></aside><article class="article-prose">${a.sections
    .map(
      (s, i) =>
        `<section ${s[0] ? `id="section-${i}"` : ""}>${s[0] ? `<h2>${s[0]}</h2>` : ""}${s
          .slice(1)
          .map((p) => `<p>${p}</p>`)
          .join("")}</section>`,
    )
    .join(
      "",
    )}<div class="article-signoff"><p>Have a different perspective? I’d like to hear it.</p>${link("/contact", "Continue the conversation")}</div></article></div><a class="next-essay" href="/journal/${next.slug}">${eyebrow("Keep reading")}<h2>${next.title} ${arrow}</h2></a>`;
  pages.push([
    `journal/${a.slug}.html`,
    page(a.title, a.deck, body, "Writing", "article-page"),
  ]);
}
pages.push([
  "404.html",
  page(
    "Page not found",
    "This page could not be found.",
    `${intro("404 / A wrong turn", "Let’s get you<br><em>back on track.</em>", "The page you’re looking for isn’t here. The work, writing, and contact details are a good place to start.")}${link("/", "Back to home", "button button-dark")}`,
    "",
    "not-found",
  ),
]);
await mkdir(path.join(publicDir, "journal"), { recursive: true });
for (const [filename, html] of pages)
  await writeFile(path.join(publicDir, filename), html);
console.log(
  `Built ${pages.length} pages. Essays: ${articles.map((a) => `${a.slug}: ${wordCount(a)} words`).join("; ")}.`,
);
if (!profile.portrait || !profile.introductionVideo)
  console.log(
    "Submission assets still needed:",
    !profile.portrait ? "portrait" : "",
    !profile.introductionVideo ? "one-minute introduction video" : "",
  );
