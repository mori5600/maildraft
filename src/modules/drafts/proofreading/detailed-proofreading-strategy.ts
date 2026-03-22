export interface DetailedProofreadingStrategy<Input, Output> {
  matches: (input: Input) => boolean;
  resolve: (input: Input) => Output;
}

export function resolveDetailedProofreadingStrategy<Input, Output>(
  strategies: readonly DetailedProofreadingStrategy<Input, Output>[],
  input: Input,
  fallback: (input: Input) => Output,
): Output {
  const strategy = strategies.find(({ matches }) => matches(input));
  return (strategy?.resolve ?? fallback)(input);
}
