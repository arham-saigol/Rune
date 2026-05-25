import Exa from 'exa-js';

function getExa() {
  const key = process.env.EXA_API_KEY;
  if (!key) throw new Error('Missing EXA_API_KEY');
  return new Exa(key);
}

export async function webSearch(query: string) {
  const exa = getExa();
  const result = await exa.search(query, { type: 'auto', numResults: 5 });
  return result.results.map((r: any) => ({
    title: r.title,
    url: r.url,
    highlight: r.highlight,
  }));
}
