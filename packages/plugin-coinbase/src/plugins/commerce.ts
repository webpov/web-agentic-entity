import {
    composeContext,
    elizaLogger,
    generateObjectV2,
    ModelClass,
    Provider,
} from "@ai16z/eliza";
import {
    Action,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    Plugin,
    State,
} from "@ai16z/eliza";
import { ChargeContent, ChargeSchema, isChargeContent } from "../types";
import { chargeTemplate, getChargeTemplate } from "../templates";
import { getWalletDetails } from "../utils";
import { Coinbase } from "@coinbase/coinbase-sdk";

const url = "https://api.commerce.coinbase.com/charges";
interface ChargeRequest {
    name: string;
    description: string;
    pricing_type: string;
    local_price: {
        amount: string;
        currency: string;
    };
}

export async function createCharge(apiKey: string, params: ChargeRequest) {
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CC-Api-Key": apiKey,
            },
            body: JSON.stringify(params),
        });

        if (!response.ok) {
            throw new Error(`Failed to create charge: ${response.statusText}`);
        }

        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error("Error creating charge:", error);
        throw error;
    }
}

// Function to fetch all charges
export async function getAllCharges(apiKey: string) {
    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "X-CC-Api-Key": apiKey,
            },
        });

        if (!response.ok) {
            throw new Error(
                `Failed to fetch all charges: ${response.statusText}`
            );
        }

        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error("Error fetching charges:", error);
        throw error;
    }
}

// Function to fetch details of a specific charge
export async function getChargeDetails(apiKey: string, chargeId: string) {
    const getUrl = `${url}${chargeId}`;

    try {
        const response = await fetch(getUrl, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "X-CC-Api-Key": apiKey,
            },
        });

        if (!response.ok) {
            throw new Error(
                `Failed to fetch charge details: ${response.statusText}`
            );
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error(
            `Error fetching charge details for ID ${chargeId}:`,
            error
        );
        throw error;
    }
}

export const createCoinbaseChargeAction: Action = {
    name: "CREATE_CHARGE",
    similes: [
        "MAKE_CHARGE",
        "INITIATE_CHARGE",
        "GENERATE_CHARGE",
        "CREATE_TRANSACTION",
        "COINBASE_CHARGE",
    ],
    description: "Create a charge using Coinbase Commerce.",
    validate: async (runtime: IAgentRuntime, _message: Memory) => {
        const coinbaseCommerceKeyOk = !!runtime.getSetting(
            "COINBASE_COMMERCE_KEY"
        );

        // Ensure Coinbase Commerce API key is available
        return coinbaseCommerceKeyOk;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback: HandlerCallback
    ) => {
        elizaLogger.log("Composing state for message:", message);
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const context = composeContext({
            state,
            template: chargeTemplate,
        });

        const chargeDetails = await generateObjectV2({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
            schema: ChargeSchema,
        });
        if (!isChargeContent(chargeDetails.object)) {
            throw new Error("Invalid content");
        }
        const charge = chargeDetails.object as ChargeContent;
        if (!charge || !charge.price || !charge.type) {
            callback(
                {
                    text: "Invalid charge details provided.",
                },
                []
            );
            return;
        }

        elizaLogger.log("Charge details received:", chargeDetails);

        // Initialize Coinbase Commerce client

        try {
            // Create a charge
            const chargeResponse = await createCharge(
                runtime.getSetting("COINBASE_COMMERCE_KEY"),
                {
                    local_price: {
                        amount: charge.price.toString(),
                        currency: charge.currency,
                    },
                    pricing_type: charge.type,
                    name: charge.name,
                    description: charge.description,
                }
            );

            elizaLogger.log(
                "Coinbase Commerce charge created:",
                chargeResponse
            );

            callback(
                {
                    text: `Charge created successfully: ${chargeResponse.hosted_url}`,
                    attachments: [
                        {
                            id: crypto.randomUUID(),
                            url: chargeResponse.id,
                            title: "Coinbase Commerce Charge",
                            description: `Charge ID: ${chargeResponse.id}`,
                            text: `Pay here: ${chargeResponse.hosted_url}`,
                            source: "coinbase",
                        },
                    ],
                },
                []
            );
        } catch (error) {
            elizaLogger.error(
                "Error creating Coinbase Commerce charge:",
                error
            );
            callback(
                {
                    text: "Failed to create a charge. Please try again.",
                },
                []
            );
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Create a charge for $10.00 USD to Chris for dinner",
                    data: {
                        local_price: {
                            amount: "10.00",
                            currency: "USD",
                        },
                        pricing_type: "fixed_price",
                        buyer_locale: "en-US",
                        cancel_url: "https://example.com/cancel",
                        redirect_url: "https://example.com/success",
                    },
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Charge created successfully: {{charge.id}} for {{charge.amount}} {{charge.currency}}",
                    action: "CREATE_CHARGE",
                },
            },
        ],
    ],
} as Action;

export const getAllChargesAction: Action = {
    name: "GET_ALL_CHARGES",
    similes: ["FETCH_ALL_CHARGES", "RETRIEVE_ALL_CHARGES", "LIST_ALL_CHARGES"],
    description: "Fetch all charges using Coinbase Commerce.",
    validate: async (runtime: IAgentRuntime) => {
        const coinbaseCommerceKeyOk = !!runtime.getSetting(
            "COINBASE_COMMERCE_KEY"
        );

        // Ensure Coinbase Commerce API key is available
        return coinbaseCommerceKeyOk;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback: HandlerCallback
    ) => {
        try {
            elizaLogger.log("Composing state for message:", message);
            if (!state) {
                state = (await runtime.composeState(message)) as State;
            } else {
                state = await runtime.updateRecentMessageState(state);
            }
            const charges = await getAllCharges(
                runtime.getSetting("COINBASE_COMMERCE_KEY")
            );

            elizaLogger.log("Fetched all charges:", charges);

            callback(
                {
                    text: `Successfully fetched all charges. Total charges: ${charges.length}`,
                },
                []
            );
        } catch (error) {
            elizaLogger.error("Error fetching all charges:", error);
            callback(
                {
                    text: "Failed to fetch all charges. Please try again.",
                },
                []
            );
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Fetch all charges" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Successfully fetched all charges.",
                    action: "GET_ALL_CHARGES",
                },
            },
        ],
    ],
} as Action;

export const getChargeDetailsAction: Action = {
    name: "GET_CHARGE_DETAILS",
    similes: ["FETCH_CHARGE_DETAILS", "RETRIEVE_CHARGE_DETAILS", "GET_CHARGE"],
    description: "Fetch details of a specific charge using Coinbase Commerce.",
    validate: async (runtime: IAgentRuntime) => {
        const coinbaseCommerceKeyOk = !!runtime.getSetting(
            "COINBASE_COMMERCE_KEY"
        );

        // Ensure Coinbase Commerce API key is available
        return coinbaseCommerceKeyOk;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback: HandlerCallback
    ) => {
        elizaLogger.log("Composing state for message:", message);
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const context = composeContext({
            state,
            template: getChargeTemplate,
        });
        const chargeDetails = await generateObjectV2({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
            schema: ChargeSchema,
        });
        if (!isChargeContent(chargeDetails.object)) {
            throw new Error("Invalid content");
        }
        const charge = chargeDetails.object as ChargeContent;
        if (!charge.id) {
            callback(
                {
                    text: "Missing charge ID. Please provide a valid charge ID.",
                },
                []
            );
            return;
        }

        try {
            const chargeDetails = await getChargeDetails(
                runtime.getSetting("COINBASE_COMMERCE_KEY"),
                charge.id
            );

            elizaLogger.log("Fetched charge details:", chargeDetails);

            callback(
                {
                    text: `Successfully fetched charge details for ID: ${charge.id}`,
                    attachments: [
                        {
                            id: crypto.randomUUID(),
                            url: chargeDetails.hosted_url,
                            title: `Charge Details for ${charge.id}`,
                            description: `Details: ${JSON.stringify(chargeDetails, null, 2)}`,
                            source: "coinbase",
                            text: "",
                        },
                    ],
                },
                []
            );
        } catch (error) {
            elizaLogger.error(
                `Error fetching details for charge ID ${charge.id}:`,
                error
            );
            callback(
                {
                    text: `Failed to fetch details for charge ID: ${charge.id}. Please try again.`,
                },
                []
            );
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Fetch details of charge ID: 123456",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Successfully fetched charge details. {{charge.id}} for {{charge.amount}} {{charge.currency}} to {{charge.name}} for {{charge.description}}",
                    action: "GET_CHARGE_DETAILS",
                },
            },
        ],
    ],
};

export const chargeProvider: Provider = {
    get: async (runtime: IAgentRuntime, _message: Memory) => {
        const charges = await getAllCharges(
            runtime.getSetting("COINBASE_COMMERCE_KEY")
        );
        // Ensure API key is available
        const coinbaseAPIKey =
            runtime.getSetting("COINBASE_API_KEY") ??
            process.env.COINBASE_API_KEY;
        const coinbasePrivateKey =
            runtime.getSetting("COINBASE_PRIVATE_KEY") ??
            process.env.COINBASE_PRIVATE_KEY;
        const balances = [];
        const transactions = [];
        if (coinbaseAPIKey && coinbasePrivateKey) {
            Coinbase.configure({
                apiKeyName: coinbaseAPIKey,
                privateKey: coinbasePrivateKey,
            });
            const { balances, transactions } = await getWalletDetails(runtime);
            elizaLogger.log("Current Balances:", balances);
            elizaLogger.log("Last Transactions:", transactions);
        }
        elizaLogger.log("Charges:", charges);
        return { charges: charges.data, balances, transactions };
    },
};

export const coinbaseCommercePlugin: Plugin = {
    name: "coinbaseCommerce",
    description:
        "Integration with Coinbase Commerce for creating and managing charges.",
    actions: [
        createCoinbaseChargeAction,
        getAllChargesAction,
        getChargeDetailsAction,
    ],
    evaluators: [],
    providers: [chargeProvider],
};
