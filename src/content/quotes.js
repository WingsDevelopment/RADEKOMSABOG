// Add a quote once; triggers determine where it can appear. Audio is metadata only.
// No audio is loaded or played. IDs stay stable when the wording changes.
export const radeQuotes = [
  { id: 'bezite-nobovi', sr: 'BEŽITE NOBOVI.', en: 'RUN, NOOBS.', audio: null, priority: 100, triggers: ['signup'] },
  { id: 'life-chess', sr: 'RADE KOMŠA JE ŽIVOTNI ŠAHISTA.', en: 'RADE KOMŠA PLAYS LIFE CHESS.', audio: null, triggers: ['logo', 'chess', 'faq'] },
  { id: 'state-of-mid', sr: 'MID JE STANJE UMA.', en: 'MID IS A STATE OF MIND.', audio: null, triggers: ['oracle', 'badge', 'myth'] },
  { id: 'counterpick', sr: 'NE POSTOJI COUNTERPICK. POSTOJI SAMO NEDOVOLJNA PRIPREMA.', en: 'THERE IS NO COUNTERPICK. ONLY INSUFFICIENT PREPARATION.', audio: null, triggers: ['faq', 'myth', 'oracle'] },
  { id: 'gank', sr: 'NE GANKUJEŠ TI RADETA. RADE DOZVOLJAVA DA PRIĐEŠ.', en: 'YOU DO NOT GANK RADE. HE GRANTS YOU AN AUDIENCE.', audio: null, triggers: ['oracle', 'faq', 'decoration'] },
  { id: 'creep-fate', sr: 'SVAKI CREEP IMA SUDBINU.', en: 'EVERY CREEP HAS A DESTINY.', audio: null, triggers: ['myth', 'chess', 'badge'] },
  { id: 'minimap', sr: 'POGLEDAJ MINIMAPU. RADE JE VEĆ TAMO.', en: 'CHECK THE MINIMAP. RADE IS ALREADY THERE.', audio: null, triggers: ['logo', 'oracle', 'decoration'] },
  { id: 'vision', sr: 'NE TREBA MU VISION. VISION TREBA NJEGA.', en: 'HE DOES NOT NEED VISION. VISION NEEDS HIM.', audio: null, triggers: ['decoration', 'badge', 'faq'] },
  { id: 'constant', sr: 'MMR JE BROJ. RADE JE KONSTANTA.', en: 'MMR IS A NUMBER. RADE IS A CONSTANT.', audio: null, triggers: ['badge', 'myth', 'logo'] },
  { id: 'ward', sr: 'AKO SI VIDEO RADETA NA WARDU, ON JE VEĆ VIDEO TEBE.', en: 'IF YOUR WARD SAW RADE, HE ALREADY SAW YOU.', audio: null, triggers: ['oracle', 'faq', 'chess'] },
];

export function pickQuote(trigger, random = Math.random) {
  const candidates = radeQuotes.filter(quote => quote.triggers.includes(trigger));
  const highest = Math.max(...candidates.map(quote => quote.priority || 0));
  const pool = highest > 0 ? candidates.filter(quote => quote.priority === highest) : candidates;
  return pool.length ? pool[Math.floor(random() * pool.length)] : null;
}
