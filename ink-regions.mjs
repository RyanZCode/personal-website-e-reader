export function mergeRects(rects) {
  const result = [];
  for (const rect of rects) {
    if (!rect || rect.width <= 0 || rect.height <= 0) continue;
    let merged = { ...rect };
    for (let i = 0; i < result.length;) {
      const other = result[i];
      const sameLine = Math.abs(merged.top - other.top) < .5 && Math.abs(merged.height - other.height) < .5;
      const overlapX = merged.left <= other.left + other.width && other.left <= merged.left + merged.width;
      const overlapY = merged.top < other.top + other.height && other.top < merged.top + merged.height;
      if (overlapX && (overlapY || sameLine)) {
        const left = Math.min(merged.left, other.left);
        const top = Math.min(merged.top, other.top);
        merged = { left, top,
          width: Math.max(merged.left + merged.width, other.left + other.width) - left,
          height: Math.max(merged.top + merged.height, other.top + other.height) - top };
        result.splice(i, 1);
        i = 0;
      } else i++;
    }
    result.push(merged);
  }
  return result;
}

export function changedTextRects(before, after, { groupDigits = false } = {}) {
  let start = 0;
  while (start < before.text.length && start < after.text.length && before.text[start] === after.text[start]) start++;
  let oldEnd = before.text.length;
  let newEnd = after.text.length;
  while (oldEnd > start && newEnd > start && before.text[oldEnd - 1] === after.text[newEnd - 1]) { oldEnd--; newEnd--; }
  if (groupDigits && before.text !== after.text) {
    const digit = value => /[0-9]/.test(value || '');
    while (start > 0 && ((digit(before.text[start - 1]) && digit(before.text[start])) ||
      (digit(after.text[start - 1]) && digit(after.text[start])))) start--;
    while (oldEnd < before.text.length && digit(before.text[oldEnd - 1]) && digit(before.text[oldEnd])) oldEnd++;
    while (newEnd < after.text.length && digit(after.text[newEnd - 1]) && digit(after.text[newEnd])) newEnd++;
  }
  const result = [...before.boxes.slice(start, oldEnd).flat(), ...after.boxes.slice(start, newEnd).flat()];
  for (let oldIndex = oldEnd, newIndex = newEnd; oldIndex < before.text.length; oldIndex++, newIndex++) {
    const oldBoxes = before.boxes[oldIndex] || [];
    const newBoxes = after.boxes[newIndex] || [];
    if (JSON.stringify(oldBoxes) !== JSON.stringify(newBoxes)) result.push(...oldBoxes, ...newBoxes);
  }
  for (let i = 0; i < start; i++) {
    if (JSON.stringify(before.boxes[i]) !== JSON.stringify(after.boxes[i])) result.push(...before.boxes[i], ...after.boxes[i]);
  }
  return mergeRects(result);
}

export function tailRect(panel, toggle) {
  return { left: panel.left, top: toggle.top, width: panel.width,
    height: Math.max(0, panel.top + panel.height - toggle.top) };
}
