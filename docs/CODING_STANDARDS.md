# Software design principles

VerseType follows established object-oriented, functional, and TypeScript design
principles. These are architectural requirements, not optional style preferences.
The construction guidance in this document is also informed by Steve McConnell's
*Code Complete, Second Edition*. The rules below adapt those concepts to this
codebase; they are not quotations or a substitute for the book.

## Construction readiness

Do not begin implementation until the problem is understood well enough to state
the expected behavior and prove that the result works.

- Identify the user-visible outcome, inputs, outputs, invariants, failure modes,
  and compatibility constraints before editing.
- Resolve requirements that would materially change the design. Do not bury an
  unresolved product decision in an implementation default.
- Inspect the relevant architecture, existing abstractions, tests, and nearby
  conventions before introducing a new path.
- For risky changes, write down a short implementation sketch or pseudocode
  before writing syntax. Refine it until each step is at one level of abstraction.
- Define the smallest check that directly demonstrates the requested behavior.
- Prefer incremental, reversible construction over a large speculative rewrite.

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

### Manage complexity deliberately

The primary technical goal is to minimize how much a reader must hold in working
memory at one time.

- Hide incidental details behind cohesive names and narrow interfaces.
- Decompose by stable responsibilities, not merely to reduce line counts.
- Keep each routine at one conceptual level; orchestration should read as a
  sequence of domain operations rather than low-level mechanics.
- Prefer direct, unsurprising code over clever compression.
- Make dependencies, state transitions, units, and coordinate systems explicit.
- Do not make one concept configurable in several places. Establish one source
  of truth and derive the rest.
- When two implementations are both correct, prefer the one with fewer states,
  branches, implicit assumptions, and special cases.

### Design during construction

Design continues while code is written, but changes must remain intentional.

- Use abstraction, encapsulation, information hiding, and explicit contracts to
  isolate likely sources of change.
- Keep policy separate from mechanism. Domain rules decide *what* happens;
  adapters decide *how* browser, storage, network, or audio work is performed.
- Prefer table-driven data or typed registries when behavior varies by a finite
  key, such as game mode, enemy type, upgrade, or theme.
- Record non-obvious tradeoffs in a concise comment or decision document near
  the affected boundary.
- Treat repeated exceptions and growing conditionals as design feedback. Stop
  and reshape the abstraction instead of adding another patch.
- Build the simplest design that satisfies known requirements while preserving
  a clear extension point for likely changes.

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

## Routine design

- Create a routine when it names a meaningful operation, removes duplication,
  contains a cohesive calculation, or hides an unstable detail.
- Give routines intention-revealing verb phrases. A caller should understand the
  operation without reading its body.
- Keep parameter lists small and cohesive. Replace repeated primitive bundles
  with a named type when they represent one concept.
- Do not use boolean parameters when the call site becomes ambiguous; prefer a
  descriptive union, options object, or separate operation.
- Avoid output parameters and hidden mutation. Return the result or mutate only
  state clearly owned by the receiving object/module.
- Put precondition validation at public and infrastructure boundaries. Internal
  helpers may rely on established invariants when their contract is clear.
- Keep normal behavior visually dominant. Handle invalid or exceptional cases
  early, then proceed through the primary path.
- Split a routine when its name requires “and,” its body mixes abstraction
  levels, or its branches represent independent policies.

## Data and variable discipline

- Declare variables as close as practical to first use and initialize them
  immediately.
- Minimize scope and lifetime. Do not retain state after the operation that owns
  it has finished.
- Use one variable for one purpose. Do not recycle a variable for a different
  meaning later in a routine.
- Name quantities with their domain meaning and units, such as
  `elapsedSeconds`, `accuracyPercent`, or `viewportWidth`.
- Replace parallel arrays and loosely related primitives with typed records.
- Prefer immutable bindings and readonly inputs. Introduce mutation only where
  ownership is local and the lifecycle is obvious.
- Avoid sentinel values when a union, `null`, or an explicit result type can
  represent absence or failure safely.
- Keep calculated values derived rather than synchronized manually across
  multiple state fields.

## Control flow

- Order statements so dependencies and the primary narrative are apparent.
- Prefer positive conditions and early exits over deeply nested branches.
- Keep loop initialization, termination, and progress obvious and colocated.
- Use `for...of` for collection traversal when an index is not part of the
  domain rule.
- Avoid modifying a collection while iterating it unless the operation is
  explicitly designed and tested for that behavior.
- Replace repeated `if`/`switch` ladders with typed lookup tables when keys map
  directly to data or strategies.
- Every finite-state `switch` must be exhaustive.
- Do not rely on operator precedence when parentheses make the intended grouping
  clearer.
- Extract complex boolean expressions into named predicates that state the
  business meaning.

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

## Defensive programming

Defensive checks protect trust boundaries without obscuring programmer errors.

- Validate external data once at entry, normalize it, and pass trusted domain
  values inward.
- Distinguish malformed input, unavailable infrastructure, expected domain
  rejection, and impossible internal state.
- Use assertions for conditions that indicate a programming defect, not for
  recoverable user or network errors.
- Do not allow invalid partial state to escape a constructor, parser, or state
  transition.
- Clamp values only when clamping is the defined domain behavior. Otherwise
  reject the invalid value visibly.
- Include enough context in errors to identify the failed operation while
  preserving the original cause.
- Recovery behavior must be explicit and tested; never invent success-shaped
  fallback data.

## Error handling

- Preserve the original error cause.
- Translate infrastructure errors into actionable application errors.
- Never silently swallow failures or return success-shaped fallback values.
- Catch errors only where they can be handled, enriched, or displayed.
- Invalid internal states should fail early with descriptive messages.

## Implementation workflow

1. Confirm requirements, invariants, and the direct validation target.
2. Trace the existing behavior and identify its state owner.
3. Sketch the solution in domain language before introducing syntax.
4. Implement the smallest coherent slice and keep it buildable.
5. Review the diff for accidental complexity, duplication, weak names, and
   unrelated changes.
6. Run the narrowest existing checks that prove the behavior, then broaden only
   when risk or failures justify it.
7. Commit the verified unit before starting unrelated work.

During implementation:

- Compile or type-check early enough to catch interface mistakes before they
  spread.
- Keep temporary scaffolding unmistakable and remove it before committing.
- Do not comment out old implementations; version control already preserves
  them.
- When a first approach exposes a weak abstraction, revise the design rather
  than layering compensating conditions on top.

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

## Review, testing, and debugging

- Review requirements and design assumptions as well as source code; defects
  prevented upstream are cheaper than defects debugged later.
- Tests should cover normal behavior, boundaries, invalid inputs, state
  transitions, and previously failing cases.
- A bug fix must include a regression test at the lowest practical layer.
- Prefer deterministic tests. Inject time and randomness, and avoid timing-based
  sleeps when state can be advanced directly.
- Reproduce a defect before changing code. Reduce it to the smallest failing
  case and fix the root cause rather than its visible symptom.
- Change one hypothesis at a time while debugging and use evidence from state,
  logs, tests, or browser geometry rather than intuition alone.
- Remove diagnostic output and temporary probes after the cause is understood.
- Treat code review as defect detection and knowledge sharing, not formatting
  debate. Automated tools own mechanical style where available.

## Refactoring and performance

- Refactor in behavior-preserving steps with tests protecting the relevant
  contract.
- Separate structural cleanup from behavior changes when either can stand as an
  independently useful commit.
- Refactor when duplication, excessive coupling, unclear ownership, long
  routines, or repeated special cases make the next change unsafe.
- Do not optimize based on intuition. Establish a measurable problem, profile or
  benchmark it, change one relevant factor, and compare results.
- Prefer architectural and algorithmic improvements over low-level code tricks.
- Never trade correctness or maintainability for an unmeasured speedup.

## Quality gate

Before merging:

1. The implementation matches the stated behavior and boundary cases.
2. Type checking succeeds.
3. Existing behavior tests and new regression tests succeed.
4. The production build succeeds.
5. No source file gained an avoidable second responsibility.
6. New duplication was removed or deliberately justified.
7. New side effects have explicit ownership and cleanup.
8. Error paths are observable and do not return misleading success.
9. Performance claims are supported by measurements.

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
