import { Plugin } from "@ai16z/eliza";
import { helloWorldAction } from "./actions/helloWorld.ts";
import { factEvaluator } from "./evaluators/fact.ts";
import { timeProvider } from "./providers/time.ts";

export * as evaluators from "./evaluators/index.ts";
export * as providers from "./providers/index.ts";

export const webTradingPlugin: Plugin = {
    name: "webTrading",
    description: "Agent to trade on web",
    actions: [
        helloWorldAction,
    ],
    evaluators: [factEvaluator],
    providers: [timeProvider],
};
