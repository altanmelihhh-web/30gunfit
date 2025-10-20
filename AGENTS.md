# Repository Guidelines

## Project Structure & Module Organization
The app follows the Create React App layout: core code lives in `src/`, static assets in `public/`, and dependencies in `node_modules/`. Feature components sit in `src/components`, each paired with a matching CSS file (for example, `src/components/Calendar.js` with `Calendar.css`) to keep logic and styling co-located. Shared data and selectors are centralized in `src/data/workoutProgram.js`, so add new program content or helpers there rather than scattering JSON literals across components.

## Build, Test, and Development Commands
Use `npm start` for the dev server with hot reload at `http://localhost:3000`. Run `npm test` to launch the Jest and React Testing Library watcher; add `-- --runInBand` when debugging flaky suites. Execute `npm run build` to produce the optimized production bundle in `build/`; inspect its output before shipping updates.

## Coding Style & Naming Conventions
Write modern React function components with hooks—see `src/App.js` for patterns on state isolation, memoization, and localStorage guards. Keep two-space indentation, end statements with semicolons, and prefer descriptive camelCase for variables plus PascalCase for components (`ProgressSummary`, `ReminderSettings`). Mirror the existing folder naming by grouping styles with their components and exporting helpers from `src/data` through named exports to simplify tree-shaking.

## Testing Guidelines
Tests live alongside the code under `src/`; follow the example `src/App.test.js` and import setup helpers from `src/setupTests.js`. Name new specs `<Component>.test.js` and exercise user-visible behavior with React Testing Library queries rather than implementation details. Aim to cover new branches and side effects; run `npm test -- --coverage` before opening a PR if your changes touch core flows such as progress tracking or reminders.

## Commit & Pull Request Guidelines
This repository currently lacks committed history, so adopt Conventional Commits (e.g., `feat: add rest-day reminder toggle`) to keep the log searchable and informative. Reference related issues in the PR description, summarize user-facing impact, and attach screenshots or GIFs when UI changes affect `Calendar` or `DayDetail`. Include test output snippets or notes about coverage runs so reviewers can verify the safety of the change quickly.
