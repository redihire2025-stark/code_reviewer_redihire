# AI Review Rules — Repository Coding Standards
# Place this file at .ai-review/rules.md in your repository root.
# The AI reviewer will load and enforce these rules on every PR.

## State Management (Zustand)

- All Zustand stores must use selectors to prevent unnecessary re-renders.
  Bad: `const store = useGameStore()` then accessing `store.score`
  Good: `const score = useGameStore(state => state.score)`

- Never mutate Zustand state directly. Always use the store's set function.

- Separate UI state stores from domain/game state stores.

## React Patterns

- Avoid prop drilling deeper than 2 levels. Use context or Zustand for deeper trees.

- No business logic inside React components. Extract to custom hooks or service files.

- All event handlers must be defined outside JSX. No inline arrow functions in JSX props
  when they involve complex logic (simple callbacks like `onClick={() => setOpen(true)}` are fine).

## API & Data Fetching

- All API calls must go through the `src/services/` layer. No direct fetch() calls in components or hooks.

- Always handle loading, error, and empty states in UI components.

## React Three Fiber

- Always dispose of geometries and materials in useEffect cleanup functions.
  Missing disposal causes memory leaks in WebGL contexts.

- Reuse geometries and materials via refs or useMemo — never recreate them on every render.

## TypeScript

- No `any` types. Use `unknown` for truly unknown values and narrow with type guards.

- All props interfaces must be explicitly typed. No implicit prop types.

- Async functions must declare their return type.

## Testing

- New utility functions must have unit tests.
- New hooks must have tests verifying behavior under state changes.
- Game progression functions must have edge case tests (max score, empty state, etc.)
