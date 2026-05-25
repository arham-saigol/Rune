import Exa from 'exa-js';

function getExa() {
  const key = process.env.EXA_API_KEY;
  if (!key) throw new Error('Missing EXA_API_KEY');
  return new Exa(key);
}

export async function webFetch(url: string) {
  const exa = getExa();
  const result = await exa.getContents([url], { text: true });
  return result.results[0]?.text ?? null;
}
