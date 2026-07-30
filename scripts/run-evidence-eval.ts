import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  evaluateEvidenceEval,
  evidenceEvalInputSchema,
} from "../src/features/evaluation/evidence-eval";
import { createEvidenceEvalFixture } from "../src/features/evaluation/evidence-eval-fixture";

type CliOptions = {
  inputPath?: string;
  outputPath: string;
};

const parseArguments = (arguments_: string[]): CliOptions => {
  let inputPath: string | undefined;
  let outputPath = "output/evidence-eval/fixture-summary.json";

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    const value = arguments_[index + 1];
    if ((argument === "--input" || argument === "--output") && value) {
      if (argument === "--input") {
        inputPath = value;
      } else {
        outputPath = value;
      }
      index += 1;
      continue;
    }

    throw new Error("EVIDENCE_EVAL_ARGUMENT_INVALID");
  }

  return { inputPath, outputPath };
};

const readInput = async (inputPath: string | undefined) => {
  if (!inputPath) {
    if (process.env.RESEARCH_PROVIDER_MODE !== "fixture") {
      throw new Error("EVIDENCE_EVAL_FIXTURE_MODE_REQUIRED");
    }

    return createEvidenceEvalFixture();
  }

  return evidenceEvalInputSchema.parse(
    JSON.parse(await readFile(resolve(inputPath), "utf8")),
  );
};

export const runEvidenceEvalCli = async (arguments_: string[]) => {
  const { inputPath, outputPath } = parseArguments(arguments_);
  const summary = evaluateEvidenceEval(await readInput(inputPath));
  const resolvedOutputPath = resolve(outputPath);
  await mkdir(dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(
    `[evidence-eval] ${summary.passed ? "PASS" : "FAIL"} ${summary.caseResults.length} cases -> ${resolvedOutputPath}`,
  );

  return summary.passed ? 0 : 1;
};

runEvidenceEvalCli(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    console.error(
      `[evidence-eval] ${error instanceof Error ? error.message : "EVIDENCE_EVAL_FAILED"}`,
    );
    process.exitCode = 2;
  });
