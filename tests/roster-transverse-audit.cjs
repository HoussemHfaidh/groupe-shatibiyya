const assert = require('node:assert/strict');
const {test} = require('node:test');
const Review = require('../review-model');
const Jam = require('../jam-model');
const fs = require('node:fs');
const now = new Date('2026-09-26T12:00:00Z');
for (const [group, day] of [['group1',6], ['group2',0]]) {
  test(`${group}: review follows additions in an already opened week`, () => {
    const store=Review.ensure({},['أحمد'],day,now);
    const updated=Review.ensure(store,['أحمد','علي'],day,now);
    assert.deepEqual(updated[Review.week(day,now).id].students,['أحمد','علي']);
  });
  test(`${group}: review follows removals in an already opened week`, () => {
    const store=Review.ensure({},['أحمد','علي'],day,now);
    const updated=Review.ensure(store,['أحمد'],day,now);
    assert.deepEqual(updated[Review.week(day,now).id].students,['أحمد']);
  });
}
