export function setText(element: Element, value: string): void {
  if (element.textContent !== value) element.textContent = value;
}
export function setAttribute(element: Element, name: string, value: string): void {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}
export function createSvgLayer<T extends { id: number }>(
  layer: SVGGElement,
  content: (item: T) => string,
  update: (element: SVGGElement, item: T) => void,
  signature: (item: T) => string = () => ''
): (items: readonly T[]) => void {
  const entities = new Map<number, { element: SVGGElement; signature: string }>();
  return items => {
    const live = new Set(items.map(item => item.id));
    for (const [id, entity] of entities) {
      if (!live.has(id)) { entity.element.remove(); entities.delete(id); }
    }
    for (const item of items) {
      let entity = entities.get(item.id);
      const appearance = signature(item);
      if (!entity) {
        const element = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        entity = { element, signature: appearance };
        element.innerHTML = content(item);
        entities.set(item.id, entity);
        layer.append(element);
      } else if (entity.signature !== appearance) {
        entity.element.innerHTML = content(item);
        entity.signature = appearance;
      }
      update(entity.element, item);
    }
  };
}
