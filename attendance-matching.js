(function (root) {
  'use strict';
  // Names are matched only against the selected group's current roster.
  const clean = value => String(value ?? '').normalize('NFKD').toLowerCase()
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ء/g, '').replace(/[ىی]/g, 'ي').replace(/ک/g, 'ك').replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  const compact = value => clean(value).replace(/ /g, '');
  // Common transliterations of given names, not assignments to student identities.
  const givenNames = {
    mohamed:'محمد', mohammed:'محمد', muhammad:'محمد', ahmed:'احمد', amine:'امين',
    achraf:'اشرف', ashraf:'اشرف', achref:'اشرف', yassine:'ياسين', yassin:'ياسين',
    ines:'ايناس', iness:'ايناس', inas:'ايناس', nour:'نور', noura:'نوره',
    ousama:'اسامه', oussama:'اسامه', osama:'اسامه', asma:'اسما', asmaa:'اسما',
    khadija:'خديجه', khadidja:'خديجه', tayssir:'تيسير', taysir:'تيسير',
    hamza:'حمزه', houssem:'حسام', houssam:'حسام', hossam:'حسام',
    adem:'ادم', adam:'ادم', moez:'معز', mouez:'معز', messaoud:'مسعود', massoud:'مسعود',
    firas:'فراس', fares:'فارس', faris:'فارس', anwer:'انور', anwar:'انور', anouar:'انور'
  };
  const arabic = {ا:'a',ب:'b',ت:'t',ث:'th',ج:'j',ح:'h',خ:'kh',د:'d',ذ:'dh',ر:'r',ز:'z',س:'s',ش:'sh',ص:'s',ض:'dh',ط:'t',ظ:'dh',ع:'',غ:'gh',ف:'f',ق:'q',ك:'k',ل:'l',م:'m',ن:'n',ه:'h',و:'w',ي:'y',ء:''};
  function tokens(value) {
    return clean(value).split(' ').filter(Boolean).map(word => {
      word = givenNames[word] || word;
      word = word.replace(/^ال/, '').replace(/^(?:el|al)(?=[a-z]{4})/, '');
      word = word.replace(/ه$/, '');
      return [...word].map(c => arabic[c] ?? c).join('')
        .replace(/ou|oo/g, 'w').replace(/ch/g, 'sh').replace(/dj/g, 'j')
        .replace(/gh/g, 'r').replace(/kh/g, 'x').replace(/dh|th/g, 'd')
        .replace(/[gq]/g, 'k').replace(/[aeiouyw]/g, '').replace(/(.)\1+/g, '$1');
    }).filter(Boolean);
  }
  function distance(a, b) {
    let previous = Array.from({length:b.length + 1}, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const next = [i];
      for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j-1]+1, previous[j]+1, previous[j-1]+(a[i-1] === b[j-1] ? 0 : 1));
      previous = next;
    }
    return previous[b.length];
  }
  function resolve(name, roster = [], learned = {}) {
    const key = compact(name), names = [...new Set(roster)], remembered = Object.hasOwn(learned, key) ? learned[key] : undefined;
    if (remembered === '') return { name:null, method:'unlisted', candidates:[] };
    if (names.includes(remembered)) return { name:remembered, method:'confirmed', candidates:[remembered] };
    const exact = names.filter(n => compact(n) === key);
    if (exact.length === 1) return {name:exact[0], method:'exact', candidates:exact};
    const source = tokens(name), signature = source.join('').replace(/(.)\1+/g, '$1');
    const ranked = names.map(n => {
      const target = tokens(n), full = target.join('').replace(/(.)\1+/g, '$1');
      let score = 0;
      const literal = compact(n);
      const words = clean(name).split(' ').map(w => clean(givenNames[w] || w));
      const targetWords = clean(n).split(' ');
      if (signature && signature === full && signature.length >= 4) score = .99;
      else if (words.length && words.every(w => targetWords.includes(w)) && words.join('').length >= 3) score = .96;
      else if (targetWords.length >= 2 && targetWords.every(w => words.includes(w)) && literal.length >= 7) score = .96;
      else if (words.length >= 2 && targetWords.length >= 2 && key.length >= 7 && distance(key,literal) === 1) score = .95;
      else if (source.length > 1 && source.length === target.length && [...source].sort().join(' ') === [...target].sort().join(' ')) score = .98;
      else if (source.length && source.every(t => target.includes(t)) && signature.length >= 3) score = .94;
      else if (target.length >= 2 && target.every(t => source.includes(t)) && full.length >= 5) score = .94;
      else if (signature.length >= 6 && full.length >= 6) score = 1 - distance(signature, full) / Math.max(signature.length, full.length);
      return {name:n,score};
    }).filter(c => c.score >= .6).sort((a,b) => b.score-a.score);
    const top = ranked[0], second = ranked[1];
    // Small spelling errors require a full name and a clear margin over alternatives.
    const certain = remembered === undefined && top && (top.score >= .94 || (source.length >= 2 && top.score >= .88)) && (!second || top.score-second.score >= .12);
    return {name:certain ? top.name : null, method:certain ? 'matched' : 'review', candidates:ranked.slice(0,3).map(c => c.name)};
  }
  const api = { clean, compact, resolve, tokens };
  if (typeof module !== 'undefined') module.exports = api; else root.AttendanceMatching = api;
})(typeof window === 'undefined' ? globalThis : window);
