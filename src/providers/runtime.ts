import "server-only";

import { createFixtureResearchProviders } from "@/providers/fixtures/research-providers";
import { createBailianEmbeddingProvider } from "@/providers/live/bailian-embedding-provider";
import { createDeepSeekLanguageModel } from "@/providers/live/deepseek-language-model";
import {
  createPaidProviderSmokeBudget,
  paidProviderSmokeConstants,
  readPaidProviderSmokeEnvironment,
  type ProviderEnvironment,
} from "@/providers/live/smoke-gate";
import { createTavilySearchProvider } from "@/providers/live/tavily-provider";
import type {
  EmbeddingProvider,
  LanguageModel,
  SearchProvider,
} from "@/providers/contracts";

export type ResearchProviders = {
  search: SearchProvider;
  languageModel: LanguageModel;
  embedding: EmbeddingProvider;
  mode: "fixture" | "live";
};

const required = (environment: ProviderEnvironment, name: string) => {
  const value = environment[name]?.trim();

  if (!value) {
    throw new Error("PROVIDER_CONFIGURATION_MISSING");
  }

  return value;
};

const createLiveProviders = (
  environment: ProviderEnvironment,
): ResearchProviders => ({
  search: createTavilySearchProvider({ apiKey: required(environment, "TAVILY_API_KEY") }),
  languageModel: createDeepSeekLanguageModel({
    apiKey: required(environment, "DEEPSEEK_API_KEY"),
  }),
  embedding: createBailianEmbeddingProvider({
    apiKey: required(environment, "BAILIAN_API_KEY"),
    workspaceId: required(environment, "BAILIAN_WORKSPACE_ID"),
  }),
  mode: "live",
});

export const createResearchProviders = ({
  environment = process.env,
}: {
  environment?: ProviderEnvironment;
} = {}): ResearchProviders => {
  const isProduction = environment.NODE_ENV === "production";
  const wantsLive = isProduction || environment.RESEARCH_PROVIDER_MODE === "live";

  if (!wantsLive) {
    return { ...createFixtureResearchProviders(), mode: "fixture" };
  }

  if (!isProduction) {
    readPaidProviderSmokeEnvironment(environment);
  }

  return createLiveProviders(environment);
};

export const createPaidProviderSmokeRuntime = <T = ResearchProviders>({
  environment = process.env,
  createProviders = createLiveProviders as (
    environment: ProviderEnvironment,
  ) => T,
}: {
  environment?: ProviderEnvironment;
  createProviders?: (environment: ProviderEnvironment) => T;
} = {}) => {
  const { costLimitUsd } = readPaidProviderSmokeEnvironment(environment);
  const budget = createPaidProviderSmokeBudget(costLimitUsd);

  return {
    budget,
    costLimitUsd,
    providers: createProviders(environment),
  };
};

export const providerRuntimeConstants = paidProviderSmokeConstants;
