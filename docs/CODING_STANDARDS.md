# Software design principles

VerseType follows established object-oriented, functional, and TypeScript design
principles. These are architectural requirements, not optional style preferences.

## Core principles

### DRY — Don't Repeat Yourself

- Every business rule must have one authoritative implementation.
- Shared calculations, constants, selectors, validation, and rendering patterns
  belong in focused reusable modules.
- Do not duplicate logic merely to avoid creating an abstraction.
- Similar-looking code should only be combined when it represents the same
  concept and changes for the same reason.

### SOLID

#### Single Responsibility Principle

Every module, class, and function should have one reason to change.

- Domain modules contain rules and state transitions.
- Application services coordinate use cases.
- Views render state and emit user intentions.
- Repositories own storage and remote or static data access.
- Browser adapters own DOM, audio, timers, and `localStorage`.

Controllers must remain thin. A controller must not simultaneously calculate
scores, render HTML, access storage, fetch data, and manage timers.

#### Open/Closed Principle

Behavior should be extendable without repeatedly editing central conditionals.

- Represent modes and strategies through typed registries or interfaces.
- Add a new game mode by implementing a defined contract, not by adding
  scattered `if (mode === ...)` checks throughout the application.
- Prefer composition over inheritance.

#### Liskov Substitution Principle

Implementations of a shared contract must preserve its promises.

- Repositories return the same normalized domain data regardless of whether
  their source is static, remote, or cached.
- Alternate game modes must honor the same lifecycle and completion contracts.
- A replacement must not introduce hidden preconditions or weaker guarantees.

#### Interface Segregation Principle

Consumers receive only the capabilities they use.

- Avoid large control bags and broad service objects.
- Split views into focused interfaces such as `PassageSelectorView`,
  `TypingView`, `ResultsView`, and `DefenseView`.
- Prefer several small ports over one application-wide interface.

#### Dependency Inversion Principle

High-level rules must not depend directly on browser or provider details.

- Domain and application modules depend on interfaces.
- DOM, storage, audio, clocks, and Bible data providers implement those
  interfaces at the application boundary.
- Pass dependencies explicitly. Do not hide them in globals.

### Encapsulation

- State has a clear owner and changes through intentional operations.
- Do not expose mutable collections or implementation details unnecessarily.
- Keep module internals private unless another module has a genuine need.
- Use readonly inputs and return new values for domain transformations when
  practical.
- Browser globals, selectors, and storage keys are infrastructure details and
  must not leak into domain logic.

### Separation of concerns

Use this dependency direction:

```text
UI → application use cases → domain
          ↑
infrastructure adapters
```

The domain must remain executable without a browser. UI code must not implement
business rules. Infrastructure failures must be translated at the boundary.

## Modularity rules

- Keep files cohesive and easy to scan. **Aim for fewer than 200 lines per
  source file.** Exceeding 250 lines requires a clear justification.
- Functions should normally fit on one screen and perform one level of
  abstraction.
- Split a module when it has multiple state owners, unrelated private helpers,
  or distinct reasons to change.
- Group code by feature and responsibility, not by arbitrary technical type.
- Avoid god controllers, utility dumping grounds, and deeply nested callbacks.
- Use feature entry points to expose a small public API while keeping internal
  modules private.
- Composition roots may wire many dependencies, but must contain no business
  logic.

Suggested feature structure:

```text
feature/
  domain/          # models, rules, pure transitions
  application/     # use cases and ports
  infrastructure/  # storage, network, browser adapters
  ui/              # rendering and interaction binding
  index.ts          # narrow public API
```

## TypeScript standards

- Enable strict TypeScript.
- Do not use `any`, broad type assertions, or non-null assertions to bypass
  design problems.
- Use type-only imports where appropriate.
- Model finite states with unions rather than free-form strings.
- Validate untrusted JSON, DOM elements, storage data, and dataset attributes.
- Public functions declare meaningful input and output types.
- Prefer exhaustive mappings and switches for finite unions.
- Use named domain types instead of passing unrelated primitive strings and
  numbers through multiple layers.

## State and side effects

- Prefer pure domain functions and deterministic calculations.
- Inject clocks and randomness when they affect business behavior.
- Keep mutation local to the state owner.
- Side effects occur at application boundaries and remain observable.
- Every timer, animation frame, request, media object, and event listener has a
  lifecycle owner and cleanup path.
- Persist versioned, validated data rather than trusting arbitrary
  `localStorage` contents.

## Error handling

- Preserve the original error cause.
- Translate infrastructure errors into actionable application errors.
- Never silently swallow failures or return success-shaped fallback values.
- Catch errors only where they can be handled, enriched, or displayed.
- Invalid internal states should fail early with descriptive messages.

## UI and accessibility

- Build semantic controls and maintain keyboard parity.
- Manage focus for dialogs and workspace transitions.
- Keep ARIA state synchronized with visible and disabled state.
- Use live regions only for meaningful status changes.
- Separate rendering from application rules.
- Avoid unsafe HTML interpolation for dynamic or external values.

## Naming and readability

- Names describe intent and domain meaning, not implementation mechanics.
- Replace magic values with named constants.
- Prefer early returns and shallow control flow.
- Comments explain non-obvious decisions, constraints, or tradeoffs—not syntax.
- Delete dead code instead of commenting it out.

## Quality gate

Before merging:

1. Type checking succeeds.
2. Existing behavior tests succeed.
3. The production build succeeds.
4. No source file gained an avoidable second responsibility.
5. New duplication was removed or deliberately justified.
6. New side effects have explicit ownership and cleanup.

New work must improve these boundaries. Do not add more behavior to an already
oversized module; extract the relevant responsibility first.

## Version control

- Commit completed, verified units of work frequently rather than accumulating
  unrelated changes in one large commit.
- Create a milestone commit after each independently useful fix, feature, or
  refactor once its targeted checks pass.
- Keep each commit focused, buildable, and safe to review or revert.
- Do not mix unrelated cleanup into a feature or bug-fix commit.
- Use concise imperative commit subjects that describe the outcome.
- Never commit failing or incomplete work merely to satisfy a time interval.
- Do not amend, squash, force-push, or commit user-authored changes without
  explicit approval.
