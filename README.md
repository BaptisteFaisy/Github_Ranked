# GitHub Ranked

> Competitive skill ratings for developers based on GitHub contributions

[![CI](https://github.com/Shemarhn/Github_Ranked/actions/workflows/ci.yml/badge.svg)](https://github.com/Shemarhn/Github_Ranked/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

GitHub Ranked analyzes your GitHub activity and generates a competitive tier badge — like ranking systems in games, but for your code contributions.

![Example](https://github-ranked.vercel.app/api/rank/shemarhn)

## Quick Start

Add to your GitHub profile README:

```markdown
![GitHub Rank](https://github-ranked.vercel.app/api/rank/YOUR_USERNAME)
```

## Dashboard

View detailed stats breakdown at:

```
https://github-ranked.vercel.app/{username}
```

The dashboard shows:

- Full GP breakdown by metric
- Seasonal contribution history with decay visualization
- Raw vs. decayed stats toggle
- Embed code for your README

## Tiers

| Tier        | Rating      | Top %       |
| ----------- | ----------- | ----------- |
| Iron        | 0 - 930     | Below 75%   |
| Bronze      | 931 - 1199  | Top 75%     |
| Silver      | 1200 - 1469 | Top 50%     |
| Gold        | 1470 - 1712 | Top 25%     |
| Platinum    | 1713 - 2130 | Top 10%     |
| Emerald     | 2131 - 2436 | Top 1%      |
| Diamond     | 2437 - 2687 | Top 0.1%    |
| Master      | 2688 - 2905 | Top 0.01%   |
| Grandmaster | 2906 - 3101 | Top 0.001%  |
| Challenger  | 3102+       | Top 0.0001% |

Tiers below Master have divisions (IV to I).

## API

```
GET /api/rank/{username}
```

| Parameter | Default   | Description            |
| --------- | --------- | ---------------------- |
| `theme`   | `default` | Card theme (see below) |
| `season`  | all-time  | Year (e.g., `2024`)    |
| `force`   | `false`   | Bypass cache           |

### Themes

- `default` - GitHub dark
- `dark` - Pure black
- `light` - White/light mode
- `minimal` - Transparent background
- `cyberpunk` - Neon pink/cyan
- `ocean` - Deep blue
- `forest` - Green/nature
- `sunset` - Warm orange/red
- `galaxy` - Purple/cosmic

**Examples:**

```markdown
![Rank](https://github-ranked.vercel.app/api/rank/octocat)
![Rank](https://github-ranked.vercel.app/api/rank/octocat?theme=cyberpunk)
![Rank](https://github-ranked.vercel.app/api/rank/octocat?theme=ocean)
![Rank](https://github-ranked.vercel.app/api/rank/octocat?season=2024)
```

## How It Works

Your rank is calculated from:

| Metric        | Weight | Reason                            |
| ------------- | ------ | --------------------------------- |
| Merged PRs    | 35%    | Code accepted by peers            |
| Code Reviews  | 35%    | Mentorship, seniority signal      |
| Issues Closed | 15%    | Problem-solving                   |
| Commits       | 10%    | Activity (low to prevent farming) |
| Stars         | 5%     | Open source impact (capped at 1k) |

Collaboration metrics (PRs + Reviews) account for **70%** of your score, making it impossible to reach Diamond+ without peer interaction. The badge displays total stars, but calculations cap at 1,000.

## Seasonal System

GitHub Ranked uses a seasonal decay system inspired by competitive games like League of Legends:

| Season Age     | Weight | Example (in 2026) |
| -------------- | ------ | ----------------- |
| Current Season | 100%   | 2026              |
| Previous       | 60%    | 2025              |
| 2 years ago    | 35%    | 2024              |
| 3 years ago    | 20%    | 2023              |
| 4+ years       | 10%    | 2022 and earlier  |

This ensures your rank reflects recent activity while still rewarding consistent long-term contributions. At each new year, there's effectively a soft reset where your older contributions matter less.

## Self-Hosting

**Requirements:** Node.js 20+, GitHub PAT, Upstash Redis

```bash
git clone https://github.com/Shemarhn/Github_Ranked.git
cd Github_Ranked
npm install
cp .env.local.example .env.local
# Add your tokens to .env.local
npm run dev
```

**Environment Variables:**

| Variable                   | Required | Description                    |
| -------------------------- | -------- | ------------------------------ |
| `GITHUB_TOKEN_1`           | Yes      | GitHub PAT (`read:user` scope) |
| `GITHUB_TOKEN_2+`          | No       | Additional tokens for scaling  |
| `UPSTASH_REDIS_REST_URL`   | Yes      | Upstash Redis URL              |
| `UPSTASH_REDIS_REST_TOKEN` | Yes      | Upstash Redis token            |

## Tech Stack

- **Next.js** - App Router, API routes
- **Satori** - SVG generation
- **Upstash Redis** - Caching
- **GitHub GraphQL API** - Data source

## Contributing

PRs welcome. Fork, branch, commit, PR.

## License

MIT
