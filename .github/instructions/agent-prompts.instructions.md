---
applyTo: ".claude/**"
---

Files under this path are instructions for an AI agent: skills, rules, operating procedures, hooks, and helper scripts. They are prompts and tooling, not product code.

Review them for:

- Contradictions between two files, or between a document and the script it describes.
- References that do not resolve: paths, section numbers, step numbers, flags, script subcommands.
- Commands or code snippets that would not run as written.
- Logic errors in the shell and Node scripts.

Do not comment on wording, tone, sentence length, or Markdown formatting in these files. Those are Low at most and count toward the 5-per-review limit.
