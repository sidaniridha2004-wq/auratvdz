// Editorial content that appears on several pages. Plain data, no JSX, so it
// can also feed JSON-LD.

export interface FaqItem {
  q: string;
  a: string;
}

export const HOME_FAQ: FaqItem[] = [
  {
    q: "Is AuraTV free?",
    a: "Yes. There is no account, no subscription and no paywall. The site is paid for by a small number of ads.",
  },
  {
    q: "Which channels can I watch?",
    a: "beIN Sports, Algerian public channels, French and Arabic general and news channels, and kids' channels. Open the Channel guide on the front page and filter by category.",
  },
  {
    q: "A stream will not play. What do I do?",
    a: "First try the quality menu on the player and pick a lower resolution. If it still fails, check the Status page; if the channel is marked offline there, we already know. Otherwise report it from the Contact page and we will look within 24 hours.",
  },
  {
    q: "Why is the picture behind the live match?",
    a: "Internet streams are typically 20 to 40 seconds behind broadcast. Lower quality rungs usually have less delay.",
  },
  {
    q: "Does it work on a TV?",
    a: "Yes. Install the Android app on Android TV or Fire TV and use the remote, or cast from your phone with Chromecast.",
  },
  {
    q: "Can I add my own channels?",
    a: "Yes. Go to My channels in the footer, paste an HLS (.m3u8) link and give it a name. Your list is stored on your device only.",
  },
  {
    q: "Where do the streams come from?",
    a: "AuraTV is a guide. It does not host video. Streams are relayed from third-party providers and we remove any link on request; see the DMCA page.",
  },
  {
    q: "How do I report a broken channel or a wrong kick-off time?",
    a: "Use the Contact page or message us on Telegram. Include the channel name and what you saw. We reply within 24 hours.",
  },
];

export interface CaseStudy {
  slug: string;
  title: string;
  kicker: string;
  problem: string;
  fix: string;
  result: string;
  metric: string;
  metricLabel: string;
}

// Figures below are placeholders to be replaced with real numbers from
// analytics before publishing the page.
export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: "kickoff-latency",
    title: "Cutting time-to-first-frame at kick-off",
    kicker: "Performance",
    problem:
      "At 20:00 on match nights the player took eight seconds or more to show a picture. Everyone opened the same beIN channel at once and the upstream master playlist was fetched separately for every viewer.",
    fix: "We now build the master playlist on our own server and cache it for twenty seconds, and the player starts on the 720p rung instead of probing 1080p first.",
    result: "Median time to first frame dropped from 8.1 s to 2.4 s on a 4G connection, and the number of \"stream not responding\" reports on Telegram fell by roughly two thirds.",
    metric: "2.4 s",
    metricLabel: "time to first frame",
  },
  {
    slug: "channel-coverage",
    title: "From 40 hand-maintained links to a live directory",
    kicker: "Coverage",
    problem: "Channels were kept in a spreadsheet and pasted into a database by hand. Links broke weekly and whole categories such as the French channels were missing.",
    fix: "The guide now reads a live channel directory from the upstream API, decrypts it server-side and maps categories automatically. The old list is kept only as a fallback.",
    result: "Coverage went from about 40 channels to more than 600 across 30 categories, with no manual link maintenance.",
    metric: "600+",
    metricLabel: "channels listed",
  },
  {
    slug: "security-hardening",
    title: "Closing an open proxy",
    kicker: "Security",
    problem: "The stream relay accepted any URL and any request headers from the address bar. Anyone could use our bandwidth to relay their own files, and the admin password was stored in the client bundle.",
    fix: "Relay URLs are now signed by the server and expire; requests to private networks are refused; the admin area uses a server-issued session token and every write goes through a service-role key that never leaves the server.",
    result: "Unknown-origin relay traffic went to zero within a day and the hosting bill for egress dropped accordingly.",
    metric: "0",
    metricLabel: "open relay requests",
  },
];

export interface TeamMember {
  name: string;
  role: string;
  bio: string;
  photo: string;
}

// Replace the photos in /public/team and edit names and roles here.
export const TEAM: TeamMember[] = [
  {
    name: "Ridha Sidani",
    role: "Founder and developer",
    bio: "Builds and runs the site and the Android app. Based in Algiers. Answers most support messages personally.",
    photo: "/team/ridha.jpg",
  },
  {
    name: "Oussama",
    role: "Channel curation",
    bio: "Keeps the programme guide accurate: checks kick-off times, channel assignments and commentators every match day.",
    photo: "/team/oussama.jpg",
  },
];
