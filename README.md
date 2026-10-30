# TechDirectory platform

Private working repository for the TechDirectory build. It holds the code, settings and content the build produces, so every change has a record and can be rolled back.

The Build Scope (in the TechDirectory Project) is the source of truth for what is built and in what order. This repository holds the work itself.

## Folders

| Folder | What goes in it |
| --- | --- |
| `docs/build-log/` | One file per month: date, ticket, what changed, how to undo it |
| `site/css`, `site/js`, `site/templates` | Custom code added to the TechDirectory site, one file per ticket where possible |
| `automations/make/` | Exported automation scenarios (blueprints), named by trigger or alert ID, e.g. `A47-news-moment.json` |
| `emails/brevo/` | Email templates and copy, named by campaign or trigger |
| `help-centre/articles/` | Help Centre articles in Markdown, one per article, grouped by collection |
| `help-centre/videos/` | Video scripts and shot lists (not the video files) |
| `scripts/` | One-off scripts used for checks, imports or clean-ups |

## Rules

- **No secrets, ever.** No passwords, API keys, tokens, webhook URLs with keys in them, or customer data. Keys stay in each tool's own connection settings. Secret scanning is on for this repository.
- **No customer data.** Use test records only. Member exports never go in here.
- **One change per ticket.** Each commit message starts with the ticket ID, e.g. `B13: add TechBullion link block`.
- **Branch, then merge.** Work happens on a branch named after the ticket (`b13-techbullion-link`) and is merged to `main` when its acceptance test passes.
- **Undo path.** Every build-log entry says how to roll the change back.
