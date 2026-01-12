export function buildYorubaPrompt(text) {
  return `
Translate the sentence below into correct Yoruba WITH tone marks.
Then explain the meaning in simple English.

Sentence:
"${text}"
`;
}
