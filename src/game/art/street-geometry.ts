/** Shared world-space geometry: adjoining tiles must agree on every endpoint. */
export function tilePoint(u: number, v: number, width: number, height: number): [number, number] {
  return [width / 2 + (u - v) * width / 2, (u + v) * height / 2];
}

export function curbPoint(edge: number, along: number, inset: number): [number, number] {
  switch (edge) {
    case 0: return [along, inset];
    case 1: return [1 - inset, along];
    case 2: return [1 - along, 1 - inset];
    case 3: return [inset, 1 - along];
    default: throw new Error('Invalid street edge');
  }
}

export function curbCoordinates(edge: number, u: number, v: number): [number, number] {
  switch (edge) {
    case 0: return [u, v];
    case 1: return [v, 1 - u];
    case 2: return [1 - u, 1 - v];
    case 3: return [1 - v, u];
    default: throw new Error('Invalid street edge');
  }
}
