/// <reference types="vite/client" />

declare module "textlint-rule-prh" {
  import type { TextlintRuleModule } from "@textlint/kernel";

  const rule: TextlintRuleModule;

  export default rule;
}

declare module "textlint-rule-sentence-length" {
  import type { TextlintRuleModule } from "@textlint/kernel";

  const rule: TextlintRuleModule;

  export default rule;
}

declare module "textlint-rule-no-nfd" {
  import type { TextlintRuleModule } from "@textlint/kernel";

  const rule: TextlintRuleModule;

  export default rule;
}

declare module "@textlint-rule/textlint-rule-no-invalid-control-character" {
  import type { TextlintRuleModule } from "@textlint/kernel";

  const rule: TextlintRuleModule;

  export default rule;
}

declare module "textlint-rule-no-zero-width-spaces" {
  import type { TextlintRuleModule } from "@textlint/kernel";

  const rule: TextlintRuleModule;

  export default rule;
}

declare module "textlint-rule-no-kangxi-radicals" {
  import type { TextlintRuleModule } from "@textlint/kernel";

  const rule: TextlintRuleModule;

  export default rule;
}

declare const __APP_NAME__: string;
declare const __APP_VERSION__: string;
