export function requireElement<T extends HTMLElement>(
  id: string,
  constructor: { new (): T }
): T {
  const element = document.getElementById(id);
  if (!(element instanceof constructor)) {
    throw new Error(`Expected #${id} to be a ${constructor.name}.`);
  }
  return element;
}

export function removeChildren(element: Element): void {
  element.replaceChildren();
}
