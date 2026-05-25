import { embed } from 'ai';

export async function embedItem(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: 'voyage/voyage-4',
    value: text,
    providerOptions: {
      voyage: { inputType: 'document', outputDimension: 1024 },
    },
  });
  return embedding;
}
