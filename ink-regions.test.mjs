import test from 'node:test';
import assert from 'node:assert/strict';
import { changedTextRects, mergeRects, tailRect } from './ink-regions.mjs';

function text(text, left = 20, top = 80) {
  return { text, boxes: Array.from(text, (_, i) => [{ left: left + i * 8, top, width: 8, height: 16 }]) };
}

test('a minute change refreshes only the changed digit', () => {
  assert.deepEqual(changedTextRects(text('3:51 PM'), text('3:52 PM')),
    [{ left: 44, top: 80, width: 8, height: 16 }]);
});
test('quote counter refresh includes the leading zero for 01 to 02 and 02 to 03', () => {
  for (const [before, after] of [['01 OF 04', '02 OF 04'], ['02 OF 04', '03 OF 04']]) {
    assert.deepEqual(changedTextRects(text(before), text(after), { groupDigits: true }),
      [{ left: 20, top: 80, width: 16, height: 16 }]);
  }
});
test('quote counter wraps from 04 to 01 without refreshing an unchanged total', () => {
  assert.deepEqual(changedTextRects(text('04 OF 04'), text('01 OF 04'), { groupDigits: true }),
    [{ left: 20, top: 80, width: 16, height: 16 }]);
});
test('a shorter quote erases the old tail, including its former footprint', () => {
  assert.deepEqual(changedTextRects(text('abcdef'), text('abc')),
    [{ left: 44, top: 80, width: 24, height: 16 }]);
});
test('unchanged suffixes that move are included', () => {
  assert.deepEqual(changedTextRects(text('abc'), text('axbc')),
    [{ left: 28, top: 80, width: 24, height: 16 }]);
});
test('wrapped lines stay separate, without filling the blank area between them', () => {
  const old = text('AB');
  const next = text('CD');
  old.boxes[1][0] = { left: 20, top: 104, width: 8, height: 16 };
  next.boxes[1][0] = { left: 20, top: 104, width: 8, height: 16 };
  assert.deepEqual(changedTextRects(old, next), [
    { left: 20, top: 80, width: 8, height: 16 },
    { left: 20, top: 104, width: 8, height: 16 },
  ]);
});
test('identical text at the same position needs no refresh', () => {
  assert.deepEqual(changedTextRects(text('unchanged'), text('unchanged')), []);
});
test('experience collapse covers both the vacated and new tail, never the header', () => {
  const before = tailRect({ left: 10, top: 20, width: 860, height: 1000 }, { top: 300 });
  const after = tailRect({ left: 10, top: 20, width: 860, height: 720 }, { top: 300 });
  assert.deepEqual(mergeRects([before, after]), [{ left: 10, top: 300, width: 860, height: 720 }]);
});
test('separate button/text areas do not merge across unchanged space', () => {
  assert.equal(mergeRects([
    { left: 20, top: 80, width: 150, height: 16 },
    { left: 500, top: 80, width: 15, height: 2 },
  ]).length, 2);
});
