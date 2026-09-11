export function menuNavigationMarkup(): string {
  return `<nav class="menu-navigation" aria-label="Return navigation">
    <button class="back-to-menu" type="button">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m10 5-7 7 7 7M3 12h18"/>
      </svg>
      <span>Main menu</span>
    </button>
  </nav>`;
}
