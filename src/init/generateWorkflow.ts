/**
 * Generate a GitHub Actions workflow file for Backline.
 *
 * @remarks
 * Creates a standard workflow that runs on PR open/sync/close.
 * Uses the latest version of the Backline action.
 */
export function generateWorkflow(configPath: string = '.backline.yml'): string {
  return `name: Backline

on:
  pull_request:
    types: [opened, synchronize, closed]

permissions:
  contents: read
  pull-requests: write

jobs:
  backline:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: backlinedev/backline@v1
        with:
          config: ${configPath}
          github-token: \${{ secrets.GITHUB_TOKEN }}
`;
}
