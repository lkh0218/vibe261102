export function aabbOverlap(a, b) {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 &&
    Math.abs(a.y - b.y) < (a.h + b.h) / 2
  );
}

export function circleOverlap(cx, cy, radius, target) {
  const targetRadius = Math.max(target.w, target.h) / 2;
  const dx = cx - target.x;
  const dy = cy - target.y;
  const combined = radius + targetRadius;
  return dx * dx + dy * dy < combined * combined;
}
