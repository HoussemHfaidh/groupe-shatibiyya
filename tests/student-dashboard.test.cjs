const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../student-dashboard-model');
const now=new Date('2026-09-29T12:00:00Z');
function data(){return {name:'أحمد',day:6,config:{weeks:[{id:'w',date:'2026-09-26'}],statuses:{'احمد__w':'done'}},jam:{w:{startDate:'2026-09-26',confirmations:[{student:'أحمد'}]}},review:{'2026-09-26':{records:[{student:'أحمد',complete:true}]}},khatma:{entries:{e:{student:'أحمد',date:'2026-09-27',attendance:'absent'}}}};}
test('four completed activities produce sunny weather; khatma measures form submission',()=>{const result=M.summary(data(),now);assert.equal(result.weather,'sun');assert.equal(result.done,4);assert.match(result.cards[3].detail,/تسجيل متابعة/);});
test('partial review is never represented as complete',()=>{const value=data();value.review['2026-09-26'].records[0].complete=false;const result=M.summary(value,now);assert.equal(result.done,3);assert.equal(result.cards[2].state,'partial');assert.equal(result.weather,'partly');});
test('unopened and disabled Jam is neutral; failures are unknown',()=>{const value=data();value.jam={};assert.equal(M.summary(value,now).total,3);value.errors=['review'];assert.equal(M.summary(value,now).weather,'unknown');assert.equal(M.summary({...value,jamEnabled:false},now).cards[1].state,'waiting');});
test('new weeks and group calendars do not reuse historical completions',()=>{assert.equal(M.summary(data(),new Date('2026-10-03T04:00:00Z')).done,0);const value=data();value.day=0;const result=M.summary(value,now);assert.equal(result.week.startDate,'2026-09-27');assert.equal(result.cards[2].state,'todo');});
test('confirming a peer does not mark your own review done and explains the difference',()=>{
 const value=data();value.review['2026-09-26'].records=[{student:'علي',validator:'أحمد',complete:true}];
 const card=M.summary(value,now).cards[2];assert.equal(card.state,'todo');assert.match(card.detail,/أكدت مراجعة زميلك/);
});
