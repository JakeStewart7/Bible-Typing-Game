
export function renderText(container, game) {
  // Ensure container is set up for absolute caret positioning
  container.innerHTML = "";
  container.style.position = container.style.position || 'relative';

  const words = game.text.split(" ");
  let charIndex = 0;

  // Find the first error
  const firstErrorIndex = game.typed.findIndex(
    (c, i) => c !== game.chars[i]
  );
  const lastTypedIndex = game.typed.length - 1;

  // Determine which word the caret is currently in
  let caretWordIndex = null;
  let runningIndex = 0;
  for (let w = 0; w < words.length; w++) {
    const wordLength = words[w].length;
    if (lastTypedIndex <= runningIndex + wordLength) {
      caretWordIndex = w;
      break;
    }
    runningIndex += wordLength + 1; // +1 for space
  }

  words.forEach((word, wIdx) => {
    const wordSpan = document.createElement("span");
    wordSpan.classList.add("word");
    // Normal white-space — the container controls wrapping/overflow for the passage window.
    wordSpan.style.whiteSpace = "normal";

    // Add letters
    for (let i = 0; i < word.length; i++) {
      const span = document.createElement("span");
      span.textContent = word[i];
      span.classList.add("char");

      // Letter underline: only if this is the caret word
      if (wIdx === caretWordIndex) {
        span.classList.add("letter-underline");
      }

      // Cascading errors: green before first error, red after
      if (charIndex <= lastTypedIndex) {
        if (firstErrorIndex === -1 || charIndex < firstErrorIndex) {
          span.classList.add("correct");
        } else {
          span.classList.add("incorrect");
          span.classList.add("error-highlight");
        }
      }

      // Caret
      if (charIndex === game.typed.length) {
        span.classList.add("current");
      }

      // Recently pressed animation key
      if (typeof game.lastPressedIndex === 'number' && charIndex === game.lastPressedIndex) {
        span.classList.add('pressed');
      }

      wordSpan.appendChild(span);
      charIndex++;
    }

    // Add space after word (only error highlight if typed wrong)
    const spaceSpan = document.createElement("span");
    spaceSpan.textContent = " ";
    // Ensure spaces are treated as chars so the caret can appear on them
    spaceSpan.classList.add('char');

    if (
      charIndex <= lastTypedIndex &&
      firstErrorIndex !== -1 &&
      charIndex >= firstErrorIndex
    ) {
      spaceSpan.classList.add("incorrect");
      spaceSpan.classList.add("error-highlight");
    }
n    // Caret on space
    if (charIndex === game.typed.length) {
      spaceSpan.classList.add('current');
    }

    wordSpan.appendChild(spaceSpan);
    charIndex++;

    container.appendChild(wordSpan);
  });

  // Ensure there's a single caret element we move around smoothly
  let caret = container.querySelector('.floating-caret');
  if (!caret) {
    caret = document.createElement('div');
    caret.className = 'floating-caret';
    // Start invisible and with no transition to avoid a long slide animation from origin
    caret.style.opacity = '0';
    caret.style.transition = 'none';
    container.appendChild(caret);
  }

  const caretEl = container.querySelector('.char.current');
  if (caretEl) {
    const cRect = caretEl.getBoundingClientRect();
    const parentRect = container.getBoundingClientRect();
    const left = cRect.left - parentRect.left + container.scrollLeft;
    const top = cRect.top - parentRect.top + container.scrollTop;
    caret.style.width = Math.max(2, cRect.width * 0.08) + 'px';
    caret.style.height = cRect.height + 'px';
    // Apply transform without transition on first placement
    if (caret.style.transition === 'none') {
      caret.style.transform = `translate(${left}px, ${top}px)`;
      // Force a reflow then re-enable transition so subsequent moves animate smoothly
      // eslint-disable-next-line no-unused-expressions
      caret.offsetHeight;
      caret.style.transition = 'transform 130ms cubic-bezier(.2,.9,.2,1), width 120ms ease, opacity 160ms ease';
      caret.style.opacity = '1';
    } else {
      caret.style.transform = `translate(${left}px, ${top}px)`;
    }

    // Also ensure caret is visible within horizontal scroll
    const caretCenter = left + (cRect.width / 2);
    const viewLeft = container.scrollLeft;
    const viewRight = viewLeft + container.clientWidth;
    if (caretCenter < viewLeft + 60) {
      container.scrollTo({ left: Math.max(0, caretCenter - 60), behavior: 'smooth' });
    } else if (caretCenter > viewRight - 60) {
      container.scrollTo({ left: caretCenter - container.clientWidth + 60, behavior: 'smooth' });
    }
  }
}
