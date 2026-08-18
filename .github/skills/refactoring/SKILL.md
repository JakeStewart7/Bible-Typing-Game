# Refactoring and modularization

Use this skill when improving maintainability without changing product behavior.

## Research basis

This workflow combines Martin Fowler's refactoring catalog and dependency
refactoring guidance with established CSS architecture practices:

- https://martinfowler.com/books/refactoring.html
- https://refactoring.com/catalog/
- https://martinfowler.com/articles/refactoring-dependencies.html
- https://martinfowler.com/articles/design-token-based-ui-architecture.html

## Operating rules

1. Establish a behavior baseline before editing: run the smallest existing tests
   and build command that covers the change.
2. Identify code smells before choosing a cut: large file, long method, divergent
   change, shotgun surgery, duplicated rules, or hidden global side effects.
3. Extract by responsibility and change affinity. A module should have one
   primary reason to change and expose a small public surface.
4. Keep dependency direction explicit: UI depends on application contracts;
   application code depends on domain rules; browser and storage adapters stay at
   the boundary.
5. For CSS, use ordered layers: tokens, reset/base, layout, reusable components,
   feature styles, and responsive overrides. Keep theme values in semantic
   custom properties and keep selectors scoped to their feature.
6. Prefer composition over overrides. Avoid adding specificity solely to win a
   cascade conflict; when an inline style is unavoidable, move that responsibility
   to the owning renderer.
7. Make one independently useful extraction at a time. Preserve selectors,
   exports, DOM contracts, and runtime order unless behavior is intentionally
   changing.
8. Delete the old implementation after the replacement is wired. Do not leave
   duplicate sources of truth.
9. Validate after each milestone with tests/build and inspect the diff for
   accidental behavior or unrelated churn.
10. Document new boundaries and naming conventions close to the code they govern.

## CSS module convention

Use this import order from `src/styles/main.css`:

1. `tokens.css` — fonts, primitive values, semantic theme variables.
2. `base.css` — reset, document defaults, shared focus/visibility rules.
3. `shell.css` — app shell, header, navigation, viewport.
4. `journey.css` — Journey and campaign surfaces.
5. `typing.css` — passage selection, typing card, shared controls.
6. `arcade.css` — Arcade battlefield, enemies, HUD, and upgrades.
7. `responsive.css` — media queries only.

Keep selectors and cascade order stable during extraction. New components should
join the closest feature module instead of returning to a monolithic stylesheet.
