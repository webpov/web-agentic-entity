import {
    ActionExample,
    IAgentRuntime,
    Memory,
    type Action,
    HandlerCallback,
    State,
} from "@ai16z/eliza";

export const helloWorldAction: Action = {
    name: "HELLO_WORLD",
    similes: [],
    validate: async (_runtime: IAgentRuntime, _message: Memory) => {
        return true;
    },
    description: "Say hello to the world with the price of btc",
    handler: async (
        _runtime: IAgentRuntime,
        _message: Memory,
        state: State,
        options: { [key: string]: any },
        callback: HandlerCallback
    ): Promise<boolean> => {
        const getBtcPrice = async () => {
            const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd");
            const data = await response.json();
            return data.bitcoin.usd;
        };
        const btcPrice = await getBtcPrice();
        callback({
            text: `Hello world! The price of bitcoin is ${btcPrice}`,
        });
        return true;
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "gm" },
            },
            {
                user: "{{user2}}",
                content: { text: "gm! how are you today?", action: "HELLO_WORLD" },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "good morning" },
            },
            {
                user: "{{user2}}",
                content: { text: "Good morning! Hope you're having a great start to your day!", action: "HELLO_WORLD" },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "good morning!!" },
            },
            {
                user: "{{user2}}",
                content: { text: "Good morning! 🌞 Ready for another awesome day?", action: "HELLO_WORLD" },
            },
        ],
    ] as ActionExample[][],
} as Action;
