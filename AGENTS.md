do we have playwright mcp, chrome devtools mcp, shadcn/ui and lighthouse + axe-core and storybook         Tradibu — Senior UI/UX, Frontend and Full-Stack Engineering Audit

Act as a senior product designer, UX researcher, frontend architect, full-stack engineer, accessibility specialist and application security reviewer.

I am building Tradibu, a large multi-vendor e-commerce marketplace with separate buyer, seller and administrator experiences. My goal is to achieve a polished, trustworthy, production-quality marketplace comparable in usability and design consistency to leading international e-commerce platforms.

Phase 1: Understand the existing application

1. Inspect the entire repository structure, framework, dependencies, routes, components, database schema, authentication, APIs and current architecture.
2. Identify the existing design system, styling approach, reusable components and responsive breakpoints.
3. Identify the buyer, seller and admin journeys and how they connect.
4. Run existing tests and inspect available build, lint and type-check commands.
5. Do not assume a technology stack or replace the existing architecture without evidence.
6. Do not modify files during the initial audit.

Phase 2: Perform a comprehensive audit

Evaluate:

* UI design, typography, colour, spacing and visual hierarchy.
* Desktop, tablet and mobile responsiveness.
* Navigation, search, filters, product discovery and checkout.
* Buyer, seller and administrator dashboards.
* Accessibility, keyboard navigation, semantic HTML and form labels.
* Loading, empty, error, success and offline states.
* Performance, Core Web Vitals, image loading and unnecessary rendering.
* SEO, metadata, product URLs and structured data where appropriate.
* Authentication, authorisation, tenant isolation, input validation and API security.
* Database integrity, payment verification, inventory consistency and order lifecycle.
* Automated test coverage, maintainability, error logging and deployment readiness.

Use Playwright MCP and browser debugging tools if they are configured and available. Test the actual application instead of relying solely on source-code inspection.

Phase 3: Produce a prioritised improvement plan

For every finding, provide:

* The affected page, component or module.
* The observed problem and supporting evidence.
* Its severity: critical, high, medium or low.
* The recommended fix.
* The files and dependencies likely to be affected.
* How the fix will be tested.

Separate visual improvements from functional bugs, architectural issues and security vulnerabilities.

Phase 4: Implement improvements safely

After presenting the audit, work in small, reviewable stages.

1. Start with critical security and data-integrity problems.
2. Establish consistent design tokens and reusable UI components.
3. Improve shared layouts and navigation.
4. Improve buyer-facing product discovery and checkout.
5. Improve seller workflows and dashboards.
6. Improve admin workflows and operational visibility.
7. Add or improve automated tests.
8. Run relevant tests, linting, type checks and production builds after changes.

Preserve existing working functionality, APIs, database contracts and business rules unless a justified change is approved. Do not invent backend functionality or replace real data with mock data.

Do not remove existing features merely to simplify the redesign. Avoid unnecessary dependencies, duplicated components and large rewrites.

Never expose secrets, bypass authorisation, weaken security checks or run destructive database operations without explicit approval.

Definition of done

A change is complete only when the relevant implementation has been inspected, the applicable tests have been run, regressions have been checked, and the results have been reported honestly.

Do not claim a page is fixed or production-ready merely because its code was changed. Clearly distinguish verified results from untested assumptions.

Begin with Phase 1 and Phase 2. Give me the findings and prioritised plan before implementing changes.