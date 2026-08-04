
export function renderText(container, game) {
  container.innerHTML = "";

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
    // allow wrapping inside the word span so the container's ch-based width produces consistent line lengths
    wordSpan.style.whiteSpace = "pre-wrap";

    const wordStartIndex = charIndex;

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

      wordSpan.appendChild(span);
      charIndex++;
    }

    // Add space after word (only error highlight if typed wrong)
    const spaceSpan = document.createElement("span");
    spaceSpan.textContent = " ";
    if (
      charIndex <= lastTypedIndex &&
      firstErrorIndex !== -1 &&
      charIndex >= firstErrorIndex
    ) {
      spaceSpan.classList.add("error-highlight");
    }
    wordSpan.appendChild(spaceSpan);
    charIndex++;

    container.appendChild(wordSpan);
  });

  // Auto-scroll so the caret stays centered in the visible window
  const caretEl = container.querySelector('.char.current');
  if (caretEl) {
    // Use smooth scrolling and center the caret vertically within the text container
    caretEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }
}
