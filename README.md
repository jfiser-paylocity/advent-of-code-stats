# Advent of Code Stats Bot

A Slack bot that posts daily Advent of Code leaderboard statistics and progress
visualizations to your team's Slack channel. The bot automatically fetches data
from your private Advent of Code leaderboard, calculates completion statistics,
generates progress charts, and posts updates.

**Guide Outline**:

- [Setup](#setup)
  - [Prerequisites](#prerequisites)
  - [Install the Slack CLI](#install-the-slack-cli)
  - [Clone the Repository](#clone-the-repository)
  - [Configure Environment Variables](#configure-environment-variables)
- [Running Your Project Locally](#running-your-project-locally)
- [Creating Triggers](#creating-triggers)
- [Testing](#testing)
- [Deploying Your App](#deploying-your-app)
- [Viewing Activity Logs](#viewing-activity-logs)
- [Project Structure](#project-structure)
- [Resources](#resources)

---

## Setup

### Prerequisites

Before getting started, make sure you have:

- A Slack workspace where you have permission to install apps
- The workspace must be part of [a Slack paid plan](https://slack.com/pricing)
- An Advent of Code private leaderboard (create one at
  [adventofcode.com](https://adventofcode.com))
- Your Advent of Code session cookie (for API authentication)

### Install the Slack CLI

To use this project, you need to install and configure the Slack CLI.
Step-by-step instructions can be found in the
[Quickstart Guide](https://api.slack.com/automation/quickstart).

_Notes:_

- To avoid conflicts with your regular slack installation, install the new Slack
  CLI using an alias, for example `slack-cli`. More instructions can be found in
  [official documentation](https://docs.slack.dev/tools/slack-cli/guides/installing-the-slack-cli-for-mac-and-linux).

### Clone the Repository

Clone this repository to your local machine:

```zsh
# Clone this project
$ git clone https://github.com/jfiser-paylocity/advent-of-code-stats.git

# Change into the project directory
$ cd advent-of-code-stats
```

### Configure Environment Variables

1. Copy the example environment file:

```zsh
$ cp .env.example .env
```

2. Edit the `.env` file and add your credentials:

**How to get these values:**

- **Session Cookie**: Log into [adventofcode.com](https://adventofcode.com),
  open your browser's developer tools (F12), go to Application/Storage >
  Cookies, and copy the value of the `session` cookie
- **Leaderboard ID**: Found in your private leaderboard URL:
  `https://adventofcode.com/[year]/leaderboard/private/view/[ID]`
- **Channel ID**: Right-click on the Slack channel, select "View channel
  details", and find the Channel ID at the bottom

## Running Your Project Locally

While building your app, you can see your changes appear in your workspace in
real-time with `slack-cli run`. You'll know an app is the development version if
the name has the string `(local)` appended.

```zsh
# Run app locally
$ slack-cli run

Connected, awaiting events
```

The bot will be available in your workspace as "Advent of Code (local)".

To stop running locally, press `<Control> + C` to end the process.

## Creating Triggers

[Triggers](https://api.slack.com/automation/triggers) are what cause workflows
to run. This project includes two types of triggers:

### 1. Daily Star Progress Trigger (Scheduled)

Automatically posts statistics daily during Advent of Code (throughout December)
at 9:00 PM UTC:

```zsh
$ slack-cli trigger create --trigger-def triggers/daily_star_progress.ts
```

This creates a scheduled trigger that runs every 24 hours during the event
period.

### 2. Star Progress Link Trigger (Manual)

Creates a shortcut link that allows you to manually trigger a statistics post:

```zsh
$ slack-cli trigger create --trigger-def triggers/star_progress_link.ts
```

Copy the generated Shortcut URL and post it in your Slack channel. Clicking the
link will immediately post the current statistics.

### Important Notes

- When creating triggers, select the workspace and environment (local or
  deployed)
- Triggers created in a local environment only work when running `slack-cli run`
- Each workspace gets unique Shortcut URLs
- Triggers won't run unless the app is running locally or deployed
- You can view and manage triggers using `slack-cli trigger list`

## Testing

The project includes linting and formatting checks:

```zsh
# Run all tests (format check, lint, and unit tests)
$ deno task test

# Format code
$ deno fmt

# Lint code
$ deno lint
```

Test files should be suffixed with `_test.ts` and placed alongside their
corresponding source files.

## Deploying Your App

Once development is complete, deploy the app to Slack infrastructure:

```zsh
$ slack-cli deploy
```

During deployment:

1. The CLI will build and upload your app to Slack's infrastructure
2. You'll be prompted to create triggers for the deployed version
3. The deployed app will appear in your workspace as "Advent of Code"

After deployment:

- Create the scheduled trigger for automatic daily posts
- Create the link trigger for manual statistics requests
- The app runs on Slack's infrastructure (no need to keep your local server
  running)

To update a deployed app, simply run `slack-cli deploy` again.

## Viewing Activity Logs

Activity logs of your application can be viewed live and as they occur with the
following command:

```zsh
$ slack-cli activity --tail
```

## Project Structure

### `assets/`

Contains application assets like the app icon.

### `functions/`

[Functions](https://api.slack.com/automation/functions) are reusable building
blocks that perform specific tasks:

- **`fetch_leaderboard.ts`**: Fetches leaderboard data from Advent of Code API
- **`create_leaderboard_stats.ts`**: Calculates statistics (completion
  percentage, daily stars, etc.)
- **`generate_bar_chart.ts`**: Generates visualization charts using QuickChart
  API
- **`post_stats_message.ts`**: Posts formatted statistics message to Slack
  channel

### `triggers/`

[Triggers](https://api.slack.com/automation/triggers) determine when workflows
run:

- **`daily_star_progress.ts`**: Scheduled trigger for automatic daily posts (9
  PM UTC)
- **`star_progress_link.ts`**: Manual shortcut link trigger for on-demand
  statistics

### `workflows/`

A [workflow](https://api.slack.com/automation/workflows) orchestrates the
execution of functions:

- **`post_statistics.ts`**: Main workflow that chains together fetching,
  analyzing, visualizing, and posting statistics

### `types/`

TypeScript type definitions for data structures:

- **`leaderboard.ts`**: Types for Advent of Code leaderboard data
- **`leaderboard_stats.ts`**: Types for calculated statistics

### `manifest.ts`

The [app manifest](https://api.slack.com/automation/manifest) contains the app's
configuration, including name, description, functions, workflows, required
permissions (`chat:write`), and allowed outgoing domains (`adventofcode.com`,
`quickchart.io`).

### `deno.jsonc`

Deno configuration file with formatting, linting rules, and task definitions.

### `.env.example`

Template for environment variables needed to run the app.

## Resources

To learn more about developing automations on Slack, visit the following:

- [Automation Overview](https://api.slack.com/automation)
- [CLI Quick Reference](https://api.slack.com/automation/cli/quick-reference)
- [Samples and Templates](https://api.slack.com/automation/samples)
