// Hard rule 1: child data only ever goes to Standard models.
// Contributor-mode ids (e.g. `muse-spark-1.3-contributor`) let Meta train on prompts.

export class ContributorModelError extends Error {
  readonly model: string;

  constructor(model: string) {
    super(
      `Refusing to call "${model}": contributor-mode models may train on prompts. ` +
        "myKx only calls Standard models (e.g. muse-spark-1.3).",
    );
    this.name = "ContributorModelError";
    this.model = model;
  }
}

/** Throws `ContributorModelError` if the id names a contributor-mode model; returns the id otherwise. */
export function assertStandardModel(model: string): string {
  if (/contributor/i.test(model)) throw new ContributorModelError(model);
  return model;
}
