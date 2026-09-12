/* Calendar deadlines use Europe/Paris regardless of the browser time zone. */
(function (root) {
  const zone = 'Europe/Paris';
  function parts(date, timeZone = zone) {
    return Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  }
  function at(date, hour = 6, timeZone = zone) {
    const target = Date.parse(`${date}T${String(hour).padStart(2,'0')}:00:00Z`);
    let guess = target;
    for (let i=0;i<3;i++) {
      const p = parts(new Date(guess),timeZone);
      const wall = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
      guess += target-wall;
    }
    return new Date(guess);
  }
  function deadline(week, boundaryDay) {
    if (!week?.date) return null;
    const start = new Date(`${week.date}T00:00:00Z`);
    const offset = (Number(boundaryDay)-start.getUTCDay()+7)%7 || 7;
    start.setUTCDate(start.getUTCDate()+offset);
    return at(start.toISOString().slice(0,10));
  }
  const api = {parts,at,deadline};
  if (typeof module !== 'undefined') module.exports = api;
  else root.WeeklyClock = api;
})(globalThis);
